import React, { useEffect, useState, useRef } from "react";
import './App.css';

import mapboxgl from 'mapbox-gl'; // eslint-disable-line import/no-webpack-loader-syntax
import 'mapbox-gl/dist/mapbox-gl.css';

import proj4 from "proj4";
import SunCalc from "suncalc";

mapboxgl.accessToken = 'pk.eyJ1IjoicGVycnlyeWxhbmNlIiwiYSI6ImNsOGZncGVtNDA3czMzb2x3d2d1emFyNjcifQ.qmZ3A-AClSLvYOzFVTJbKg';

function App() {
	const mapContainer = useRef<HTMLElement | string>(null!);
	const map = useRef<mapboxgl.Map>(null!);
	const [lng, setLng] = useState(-3.436);
	const [lat, setLat] = useState(55.3781);
	const [zoom, setZoom] = useState(4);

	const removeNetworkCoverageLayer = () => {
		if(map.current.getLayer("network-coverage-layer"))
		{
			map.current.removeLayer('network-coverage-layer');
			map.current.removeSource('network-coverage');
		}
	};

	useEffect(() => {

		if (map.current) return; // initialize map only once

		map.current = new mapboxgl.Map({
			container: mapContainer.current,
			style: 'mapbox://styles/perryrylance/cl8fq9he4000h14oln9f7exgw',
			center: [lng, lat],
			zoom: zoom
		});

		map.current.on('movestart', () => removeNetworkCoverageLayer);

		map.current.on('moveend', () => {
			setLng(map.current.getCenter().lng);
			setLat(map.current.getCenter().lat);
			setZoom(map.current.getZoom());
		});

		map.current.on("load", () => {

			const now = new Date();
			const sun = SunCalc.getPosition(now, lat, lng);

			map.current.addSource('dem', {
				'type': 'raster-dem',
				'url': 'mapbox://mapbox.mapbox-terrain-dem-v1'
			});

			map.current.addLayer(
				{
					'id': 'hillshading',
					'source': 'dem',
					'type': 'hillshade',
					'paint': {
						'hillshade-illumination-anchor': 'map',
						'hillshade-illumination-direction': (180 + 360 + (sun.azimuth * 180 / Math.PI)) % 360,
						'hillshade-exaggeration': sun.altitude / (Math.PI / 2)
					}
					// insert below waterway-river-canal-shadow;
					// where hillshading sits in the Mapbox Outdoors style
				},
				// 'waterway-river-canal-shadow'
			);

			map.current.addSource("nuable-data", {
				type:			"vector",
				url:			"https://api.maptiler.com/tiles/40d914bd-a068-4b36-a43f-a0939ced4795/tiles.json?key=176n38Nio31FxGENgZ55"
			});

		});

	});

	useEffect(() => {

		if (!map.current) return;

		const bounds = map.current.getBounds();
		const bbox: Array<number> = [];

		bbox.push(bounds.getEast());
		bbox.push(bounds.getSouth());
		bbox.push(bounds.getWest());
		bbox.push(bounds.getNorth());

		const canvas = map.current.getCanvas();
		const params = new URLSearchParams();

		params.append("f", "json");
		params.append("bbox", bbox.join(","));
		params.append("size", `${canvas.width},${canvas.height}`);
		params.append("imageSR", "102113");
		params.append("bboxSR", "4326");
		params.append("layerDefs", "");
		params.append("layers", "show:0");
		params.append("transparent", "true");

		const qstr = params.toString();
		const url = `https://mapserver.vodafone.co.uk/arcgis/rest/services/Vodafone_4G_Live_Service/MapServer/export?${qstr}`;
		const abortController = new AbortController();

		fetch(url, {
			signal: abortController.signal
		})
			.then(response => response.json())
			.then(json => {

				const wkid = json.extent.spatialReference.latestWkid;

				const min = proj4(`EPSG:${wkid}`, "WGS84", {
					x: json.extent.xmin,
					y: json.extent.ymin
				});

				const max = proj4(`EPSG:${wkid}`, "WGS84", {
					x: json.extent.xmax,
					y: json.extent.ymax
				});

				const coordinates = [
					[ min.x, max.y ],
					[ max.x, max.y ],
					[ max.x, min.y ],
					[ min.x, min.y ]
				];

				removeNetworkCoverageLayer();

				map.current.addSource('network-coverage', {
					'type': 'image',
					'url': json.href,
					'coordinates': coordinates
				});
				
				map.current.addLayer({
					id: 'network-coverage-layer',
					'type': 'raster',
					'source': 'network-coverage',
					'paint': {
						'raster-fade-duration': 0,
						'raster-opacity': .5
					}
				});

			});
		
		return () => {
			abortController.abort();
		};

	}, [lat, lng, zoom]);

	return (
		<div className="App">
			<div ref={mapContainer as any} className="map-container" />
		</div>
	);
}

export default App;
