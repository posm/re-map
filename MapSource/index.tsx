import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import produce from 'immer';
import { Obj } from '@togglecorp/fujs';

import { getLayerName } from '../utils';
import { MapChildContext, SourceChildContext } from '../context';
import { Layer } from '../type';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

function useCounter(initialValue = 0): [() => void, number] {
    const [value, updateValue] = useState(initialValue);
    const increaseValue = useCallback(() => {
        updateValue((v) => v + 1);
    }, []);
    return [increaseValue, value];
}

interface Props {
    children?: React.ReactNode | null; // FIXME typings
    sourceOptions: mapboxgl.AnySourceData;
    sourceKey: string;

    geoJson?: GeoJSON.Feature<GeoJSON.Geometry>
    | GeoJSON.FeatureCollection<GeoJSON.Geometry>
    | string;
    createMarkerElement?: (properties: Record<string, unknown>) => HTMLElement;
}

const MapSource = (props: Props) => {
    const {
        sourceOptions,
        sourceKey,
        children,
        geoJson,
        createMarkerElement,
    } = props;

    const {
        map,
        mapStyle,
        setSource,
        getSource,
        removeSource,
        isSourceDefined,
        isMapDestroyed,
        debug,
    } = useContext(MapChildContext);

    const [initialDebug] = useState(debug);
    const [forceUpdate] = useCounter(0);
    const [initialGeoJson] = useState(geoJson);
    const [initialSourceOptions] = useState(sourceOptions);

    // Add source in mapboxgl and notify addition to parent
    useEffect(
        () => {
            if (!map || !sourceKey || !mapStyle) {
                return noop;
            }

            const options = initialSourceOptions.type === 'geojson'
                ? { ...initialSourceOptions, data: initialGeoJson }
                : initialSourceOptions;

            if (initialDebug) {
                console.warn(`Creating new source: ${sourceKey}`, options);
            }
            try {
                map.addSource(sourceKey, options);
            } catch (e) {
                console.error(e);
            }

            const destroy = () => {
                const source = getSource(sourceKey);
                if (!source) {
                    // console.error(`No source named: ${sourceKey}`);
                    return;
                }

                Object.entries(source.layers).forEach(([_, layer]) => {
                    layer.destroy();
                });
                removeSource(sourceKey);
            };

            setSource({ name: sourceKey, destroy, layers: {} });
            forceUpdate();

            return destroy;
        },
        [
            map, mapStyle, sourceKey,
            forceUpdate,
            getSource, removeSource, setSource,
            initialGeoJson, initialSourceOptions, initialDebug,
        ],
    );

    // Handle geoJson change
    useEffect(
        () => {
            if (!map || !sourceKey || !geoJson || !mapStyle || geoJson === initialGeoJson) {
                return;
            }
            const source = map.getSource(sourceKey);
            if (source.type === 'geojson') {
                if (initialDebug) {
                    console.warn(`Setting source geojson: ${sourceKey}`);
                }
                source.setData(geoJson);
            }
        },
        [map, mapStyle, sourceKey, geoJson, initialGeoJson, initialDebug],
    );

    const markers = useRef<Obj<mapboxgl.Marker>>({});
    const markersOnScreen = useRef<Obj<mapboxgl.Marker>>({});

    const updateMarkers = useCallback(
        () => {
            if (!map || !createMarkerElement || !sourceKey) {
                return;
            }
            const newMarkers: Obj<mapboxgl.Marker> = {};
            const features = map.querySourceFeatures(sourceKey);

            features.forEach((feature) => {
                if (feature.geometry.type !== 'Point') {
                    return;
                }
                const {
                    geometry: {
                        coordinates,
                    },
                    properties,
                } = feature;
                if (!properties || !properties.cluster) {
                    return;
                }
                const { cluster_id: clusterId } = properties;


                let marker = markers.current[clusterId];
                if (!marker) {
                    const el = createMarkerElement(properties);
                    marker = new mapboxgl.Marker({
                        element: el,
                    }).setLngLat(coordinates as mapboxgl.LngLatLike);

                    markers.current[clusterId] = marker;
                }
                newMarkers[clusterId] = marker;

                if (!markersOnScreen.current[clusterId]) {
                    marker.addTo(map);
                }
            });

            Object.keys(markersOnScreen.current).forEach((markerId) => {
                if (!newMarkers[markerId]) {
                    markersOnScreen.current[markerId].remove();
                }
            });

            markersOnScreen.current = newMarkers;
        },
        [map, createMarkerElement, sourceKey],
    );

    useEffect(
        () => {
            if (!map || !sourceKey || !mapStyle || !geoJson || !createMarkerElement) {
                return noop;
            }

            /*
            const handleData = (e: mapboxgl.EventData) => {
                if (e.sourceId !== sourceKey || !e.isSourceLoaded) {
                    return;
                }
                updateMarkers();
            };
            map.on('data', handleData);
            */
            map.on('move', updateMarkers);
            map.on('moveend', updateMarkers);

            return () => {
                // map.off('data', handleData);
                map.on('move', updateMarkers);
                map.on('moveend', updateMarkers);
            };
        },
        [map, sourceKey, mapStyle, createMarkerElement, updateMarkers, geoJson],
    );

    useEffect(
        () => {
            if (!map || !sourceKey || !mapStyle || !geoJson || !createMarkerElement) {
                return noop;
            }

            const interval = setInterval(updateMarkers, 1000);

            return () => {
                clearInterval(interval);
            };
        },
        [map, sourceKey, mapStyle, createMarkerElement, updateMarkers, geoJson],
    );

    const getLayer = useCallback(
        (layerKey: string) => {
            const source = getSource(sourceKey);
            if (!source) {
                return undefined;
            }
            return source.layers[layerKey];
        },
        [sourceKey, getSource],
    );

    const setLayer = useCallback(
        (name: string, method: (l: Layer | undefined) => (Layer | undefined)) => {
            // const { name } = layer;
            const source = getSource(sourceKey);
            if (!source) {
                console.error(`No source named: ${sourceKey}`);
                return;
            }
            // console.warn(`Registering layer: ${name}`);
            const newSource = produce(source, (safeSource) => {
                const value = method(source.layers[name]);
                if (value !== undefined) {
                    // eslint-disable-next-line no-param-reassign
                    safeSource.layers[name] = value;
                } else {
                    // eslint-disable-next-line no-param-reassign
                    delete safeSource.layers[name];
                }
            });
            setSource(newSource);
        },
        [sourceKey, getSource, setSource],
    );

    const removeLayer = useCallback(
        (layerKey: string) => {
            const source = getSource(sourceKey);
            if (!source) {
                console.error(`No source named: ${sourceKey}`);
                return;
            }

            const layer = source.layers[layerKey];
            if (!layer) {
                console.error(`No layer named: ${layerKey}`, source);
                return;
            }

            // NOTE: check if map is dis-mounted?
            if (map) {
                const id = getLayerName(sourceKey, layerKey);
                if (initialDebug) {
                    console.warn(`Removing layer: ${id}`);
                }
                map.removeLayer(id);
            }

            // console.warn(`Registering layer: ${layerKey}`);
            const newSource = produce(source, (safeSource) => {
                // eslint-disable-next-line no-param-reassign
                delete safeSource.layers[layerKey];
            });

            setSource(newSource);
        },
        [map, sourceKey, getSource, setSource, initialDebug],
    );

    if (!isSourceDefined(sourceKey)) {
        return null;
    }

    const childrenProps = {
        map,
        mapStyle,
        sourceKey,
        getLayer,
        setLayer,
        removeLayer,
        isSourceDefined,
        isMapDestroyed,
        debug: initialDebug,
    };

    return (
        <SourceChildContext.Provider value={childrenProps}>
            {children}
        </SourceChildContext.Provider>
    );
};


MapSource.defaultProps = {
};

export default MapSource;
