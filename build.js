import queryOverpass from '@derhuerst/query-overpass';
import { encode } from 'google-polyline';
import fs from 'fs';

function fetch_network() {
    const query = '[out:json][timeout:25];'
        + '('
        + 'relation["type"="route"]["route"="road"]["network"="bg:motorway"];'
        + 'relation["type"="route"]["route"="road"]["network"="bg:national"];'
        + 'relation["type"="route"]["route"="road"]["network"="bg:municipal"];'
        + ');'
        + 'out body geom;'
    return queryOverpass(query);
}

function preprocess_data(elements) {
    const routes = new Map();
    for(const osm_route of elements) {
        if(!osm_route.tags.ref) {
            continue;
        }
        const ref = isNaN(osm_route.tags.ref) ? (osm_route.tags.ref ? osm_route.tags.ref : '') : Number(osm_route.tags.ref);
        const route = routes.get(ref) || {
            ref,
            type: osm_route.tags.network.split(':')[1],
            name: osm_route.tags.name || null,
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

        routes.set(ref, route);
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
    if(!fs.existsSync('output')) {
        fs.mkdirSync('output');
    }

    for(const route of routes.values()) {
        const filename = `output/route-${route.ref.toString().replace(/\s+/g, '_')}.json`;
        fs.writeFileSync(filename, JSON.stringify(route, null, 2));
    }

    {
        const values = Array.from(routes.values());
        const short_data = values.map(r => ({
            ref: r.ref,
            type: r.type,
            name: r.name
        }));

        const to_save = {
            date: (new Date()).toISOString(),
            data: short_data
        };
        fs.writeFileSync('output/routes.json', JSON.stringify(to_save, null, 2));
    }

    {
        const values = Array.from(routes.values());
        const rows = ['export const routes_map = new Map();'];
        for(const route of values) {
            rows.push(`routes_map.set('${route.ref}', new URL('route-${route.ref.toString().replace(/\s+/g, '_')}.json', import.meta.url));`);
        }
        fs.writeFileSync('output/routes-map.js', rows.join('\n') + '\n');
    }
    console.log('Data saved successfully.');
}

function run() {
    console.time('build');
    fetch_network()
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
