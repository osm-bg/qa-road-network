import queryOverpass from '@derhuerst/query-overpass';

export function fetch_data(tag_pairs) {
    const pairs_query = tag_pairs.map(pairs =>
        `relation${pairs.map(pair => `["${pair.key}"="${pair.value}"]`).join('')}(area.searchArea);`
    ).join('');
    const query = '[out:json][timeout:25];'
        + 'area(id:3600186382)->.searchArea;'
        + '('
        + pairs_query
        + ');'
        + 'out body geom;'
    return queryOverpass(query);
}
