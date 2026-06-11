import { fetch_data } from './osm.js';
import { encode } from 'google-polyline';
import fs from 'fs';
const output_path = 'output/rivers/';

function preprocess_data(elements) {
    const routes = new Map();
    for(const osm_route of elements) {
        if(!osm_route.tags.name) {
            continue;
        }
        const name = osm_route.tags.name;
        const route = routes.get(name) || {
            name,
            type: osm_route.tags.waterway,
            lines: [],
        };

        if(!osm_route.members) {
            continue;
        }
        for(const member of osm_route.members) {
            if(member.type !== 'way') {
                continue;
            }
            const try_existing_line = route.lines.length > 0;
            let line = try_existing_line ? route.lines.find(l => {
                const last = l.at(-1);
                return last[0] === member.geometry[0].lat && last[1] === member.geometry[0].lon;
            }) : [];
            const used_existing_line = line && line.length > 0;
            if(!used_existing_line) {
                line = [];
                route.lines.push(line);
            }
            for(let i = 0; i < member.geometry.length; i++) {
                const point = member.geometry[i];
                if(i === 0 && used_existing_line) {
                    continue;
                }
                line.push([point.lat, point.lon]);
            }
        }

        routes.set(name, route);
    }
    return routes;
}

function convert_lines_to_polylines(routes) {
    for(const route of routes.values()) {
        route.polylines = route.lines.map(line => encode(line));
        delete route.lines;
    }
    return routes;
}
            

function save_data(routes) {
    if(!fs.existsSync(output_path)) {
        fs.mkdirSync(output_path);
    }

    for(const route of routes.values()) {
        const filename = `${output_path}river-${route.name.replace(/\//g, '_')}.json`;
        fs.writeFileSync(filename, JSON.stringify(route, null, 2));
    }

    {
        const values = Array.from(routes.values());
        const short_data = values.map(r => ({
            type: r.type,
            name: r.name
        }));

        const to_save = {
            date: (new Date()).toISOString(),
            data: short_data
        };
        fs.writeFileSync(`${output_path}rivers.json`, JSON.stringify(to_save, null, 2));
    }

    {
        const values = Array.from(routes.values());
        const rows = ['export const rivers_map = new Map();'];
        for(const route of values) {
            rows.push(`rivers_map.set('${route.name}', new URL('river-${route.name.replace(/\//g, '_')}.json', import.meta.url));`);
        }
        fs.writeFileSync(`${output_path}rivers-map.js`, rows.join('\n') + '\n');
    }
    console.log('Data saved successfully.');
}

function run() {
    console.time('build');
    fetch_data([
        [
            { key: 'type', value: 'waterway' }
        ]
    ])
    .then(preprocess_data)
    .then(convert_lines_to_polylines)
    .then(save_data)
    .then(() => {
        console.timeEnd('build');
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

run();
