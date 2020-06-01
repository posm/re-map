import { useContext, useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

import { getLayerName } from '../utils';
import { SourceChildContext } from '../context';
// import { Layer } from '../type';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

type Paint = mapboxgl.BackgroundPaint
| mapboxgl.FillPaint
| mapboxgl.FillExtrusionPaint
| mapboxgl.LinePaint
| mapboxgl.SymbolPaint
| mapboxgl.RasterPaint
| mapboxgl.CirclePaint
| mapboxgl.HeatmapPaint
| mapboxgl.HillshadePaint;

interface Props {
    layerKey: string;
    layerOptions: Omit<mapboxgl.Layer, 'id'>;
    onClick?: (
        feature: mapboxgl.MapboxGeoJSONFeature,
        lngLat: mapboxgl.LngLat,
        point: mapboxgl.Point,
        map: mapboxgl.Map,
    ) => boolean | undefined;
    onDoubleClick?: (
        feature: mapboxgl.MapboxGeoJSONFeature,
        lngLat: mapboxgl.LngLat,
        point: mapboxgl.Point,
        map: mapboxgl.Map,
    ) => boolean | undefined;
    // Only called for topmost layer
    onMouseEnter?: (
        feature: mapboxgl.MapboxGeoJSONFeature,
        lngLat: mapboxgl.LngLat,
        point: mapboxgl.Point,
        map: mapboxgl.Map,
    ) => void;
    onMouseLeave?: (map: mapboxgl.Map) => void;
    beneath?: string;
    onAnimationFrame?: (timestamp: number) => Paint | undefined;
}

function removeUndefined<T extends Record<string, unknown>>(obj: T) {
    const cleanNewLayerOptions: any = {};
    Object.keys(obj).forEach((key) => {
        if (key && (obj as any)[key]) {
            cleanNewLayerOptions[key] = (obj as any)[key];
        }
    });
    return cleanNewLayerOptions as T;
}

const MapLayer = (props: Props) => {
    const {
        layerKey,
        layerOptions,
        onClick,
        onDoubleClick,
        onMouseEnter,
        onMouseLeave,
        beneath,
        onAnimationFrame,
    } = props;

    const {
        map,
        mapStyle,

        sourceKey,

        setLayer,
        removeLayer,
        getLayer,
        debug,
    } = useContext(SourceChildContext);

    const [initialLayerOptions] = useState(layerOptions);
    const [initialBeneath] = useState(beneath);
    const [initialDebug] = useState(debug);

    const animationKeyRef = useRef<number | undefined>();

    // Add layer in mapboxgl
    useEffect(
        () => {
            if (!map || !sourceKey || !layerKey) {
                return noop;
            }
            const id = getLayerName(sourceKey, layerKey);

            if (initialDebug) {
                console.warn(`Creating new layer: ${id}`);
            }

            const newLayerOptions = removeUndefined({
                ...initialLayerOptions,
                id,
                source: sourceKey,
            });

            map.addLayer(
                newLayerOptions,
                initialBeneath,
            );

            const destroy = () => {
                const layer = getLayer(layerKey);
                if (!layer) {
                    // console.error(`No layer named: ${id}`);
                    return;
                }
                removeLayer(layerKey);
            };

            setLayer(
                layerKey,
                () => ({
                    name: layerKey,
                    destroy,
                }),
            );

            return destroy;
        },
        [
            map, mapStyle, sourceKey, layerKey,
            initialLayerOptions, initialBeneath, initialDebug,
            getLayer, removeLayer, setLayer,
        ],
    );

    // Notify modification on layer
    useEffect(
        () => {
            if (!map || !sourceKey || !layerKey) {
                return;
            }
            setLayer(
                layerKey,
                (layer) => layer && ({
                    ...layer,
                    onClick,
                    onDoubleClick,
                    onMouseEnter,
                    onMouseLeave,
                }),
            );
        },
        [
            map, sourceKey, layerKey,
            onClick, onDoubleClick, onMouseEnter, onMouseLeave,
            setLayer,
        ],
    );

    const {
        paint,
        filter,
        layout,
    } = layerOptions;

    // Handle paint change
    // TODO: don't call in first render
    useEffect(
        () => {
            if (!map || !sourceKey || !layerKey || !paint) {
                return;
            }
            const id = getLayerName(sourceKey, layerKey);
            Object.entries(paint).forEach(([key, value]) => {
                map.setPaintProperty(id, key, value);
            });
        },
        [map, sourceKey, layerKey, paint],
    );

    // Handle layout change
    // TODO: dont' call in first render
    useEffect(
        () => {
            if (!map || !sourceKey || !layerKey || !layout) {
                return;
            }
            const id = getLayerName(sourceKey, layerKey);
            Object.entries(layout).forEach(([key, value]) => {
                map.setLayoutProperty(id, key, value);
            });
        },
        [map, sourceKey, layerKey, layout],
    );

    // Handle filter change
    // TODO: don't call in first render
    useEffect(
        () => {
            if (!map || !sourceKey || !layerKey) {
                return;
            }
            const id = getLayerName(sourceKey, layerKey);
            map.setFilter(id, filter);
        },
        [map, sourceKey, layerKey, filter],
    );

    useEffect(
        () => {
            if (!map || !sourceKey || !layerKey || !onAnimationFrame) {
                return noop;
            }


            const handleAnimation = (timestamp: number) => {
                const values = onAnimationFrame(timestamp);
                if (values) {
                    const id = getLayerName(sourceKey, layerKey);
                    Object.entries(values).forEach(([key, value]) => {
                        map.setPaintProperty(id, key, value);
                    });
                }

                animationKeyRef.current = requestAnimationFrame(handleAnimation);
            };

            animationKeyRef.current = requestAnimationFrame(handleAnimation);

            return () => {
                if (animationKeyRef.current) {
                    cancelAnimationFrame(animationKeyRef.current);
                }
            };
        },
        [map, sourceKey, layerKey, onAnimationFrame],
    );

    return null;
};


MapLayer.defaultProps = {
};

export default MapLayer;
