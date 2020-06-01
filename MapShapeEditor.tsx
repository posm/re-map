import mapboxgl from 'mapbox-gl';
import { useContext, useEffect, useState, useRef } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw';
import { _cs } from '@togglecorp/fujs';

import { Draw } from './type';

import { MapChildContext } from './context';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

type Mode = 'simple_select' | 'direct_select' | 'draw_point' | 'draw_line_string' | 'draw_polygon';

interface EditEvent {
    features: mapboxgl.MapboxGeoJSONFeature[];
}

interface ModeChangeEvent {
    mode: Mode;
}


interface Props {
    geoJsons: mapboxgl.MapboxGeoJSONFeature[];

    onCreate?: (geojsons: mapboxgl.MapboxGeoJSONFeature[], draw: Draw) => void;
    onDelete?: (geojsons: mapboxgl.MapboxGeoJSONFeature[], draw: Draw) => void;
    onUpdate?: (geojsons: mapboxgl.MapboxGeoJSONFeature[], draw: Draw) => void;
    onModeChange?: (mode: Mode, draw: Draw) => void;

    drawOptions: object; // FIXME
    drawPosition?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left'; // FIXME
    disabled?: boolean;
}

const defaultDrawOptions = ({
    displayControlsDefault: false,
    controls: {
        point: true,
        polygon: true,
        trash: true,
    },
});

const disabledClassName = 'disabled-map-draw-control';

const MapShapeEditor = (props: Props) => {
    const {
        onCreate,
        onDelete,
        onUpdate,
        onModeChange,
        geoJsons,
        drawOptions = defaultDrawOptions,
        drawPosition = 'bottom-right',
        disabled,
    } = props;
    const {
        map,
        mapStyle,
        isMapDestroyed,
        mapContainerRef,
    } = useContext(MapChildContext);

    // const [initialGeoJsons] = useState(geoJsons);
    const [initialDrawOptions] = useState(drawOptions);
    const [initialDrawPosition] = useState(drawPosition);
    const drawRef = useRef<Draw | undefined>();

    // Create and destroy control
    useEffect(
        () => {
            if (!map || !mapStyle) {
                return noop;
            }

            const draw = new MapboxDraw(initialDrawOptions);

            map.addControl(
                draw,
                initialDrawPosition,
            );

            // Load geojsons
            // initialGeoJsons.forEach((geoJson) => {
            //     draw.add(geoJson);
            // });

            drawRef.current = draw as Draw;

            return () => {
                if (!isMapDestroyed()) {
                    map.removeControl(draw);
                }
            };
        },
        [map, mapStyle, isMapDestroyed, initialDrawOptions, initialDrawPosition],
    );

    // Handle change in draw.create
    useEffect(
        () => {
            if (!map || !mapStyle || disabled) {
                return noop;
            }

            const handleCreate = (e: EditEvent) => {
                if (onCreate && drawRef.current) {
                    onCreate(e.features, drawRef.current);
                }
                // TODO: add promoteId, set id in properties
            };

            map.on('draw.create', handleCreate);
            return () => {
                if (!isMapDestroyed()) {
                    map.off('draw.create', handleCreate);
                }
            };
        },
        [map, mapStyle, onCreate, isMapDestroyed, disabled],
    );

    // Handle change in draw.update
    useEffect(
        () => {
            if (!map || !mapStyle || disabled) {
                return noop;
            }

            const handleUpdate = (e: EditEvent) => {
                if (onUpdate && drawRef.current) {
                    onUpdate(e.features, drawRef.current);
                }
            };

            map.on('draw.update', handleUpdate);
            return () => {
                if (!isMapDestroyed()) {
                    map.off('draw.update', handleUpdate);
                }
            };
        },
        [map, mapStyle, onUpdate, isMapDestroyed, disabled],
    );

    // Handle change in draw.delete
    useEffect(
        () => {
            if (!map || !mapStyle || disabled) {
                return noop;
            }

            const handleDelete = (e: EditEvent) => {
                if (onDelete && drawRef.current) {
                    onDelete(e.features, drawRef.current);
                }
            };

            map.on('draw.delete', handleDelete);
            return () => {
                if (!isMapDestroyed()) {
                    map.off('draw.delete', handleDelete);
                }
            };
        },
        [map, mapStyle, onDelete, isMapDestroyed, disabled],
    );

    // Handle change in draw.modechange
    useEffect(
        () => {
            if (!map || !mapStyle || disabled) {
                return noop;
            }

            const handleModeChange = (e: ModeChangeEvent) => {
                if (onModeChange && drawRef.current) {
                    onModeChange(e.mode, drawRef.current);
                }
            };

            map.on('draw.modechange', handleModeChange);

            return () => {
                if (!isMapDestroyed) {
                    map.off('draw.modechange', handleModeChange);
                }
            };
        },
        [map, mapStyle, onModeChange, isMapDestroyed, disabled],
    );

    // Handle geojson update
    useEffect(
        () => {
            if (!map || !mapStyle || !drawRef.current) {
                return;
            }
            if (disabled) {
                drawRef.current.set({
                    type: 'FeatureCollection',
                    features: [],
                });
            } else {
                drawRef.current.set({
                    type: 'FeatureCollection',
                    features: geoJsons,
                });
            }
        },
        [map, mapStyle, geoJsons, disabled],
    );

    // Handle disabling controls
    useEffect(
        () => {
            if (!mapContainerRef || !mapContainerRef.current) {
                return;
            }
            if (disabled) {
                mapContainerRef.current.className = _cs(
                    mapContainerRef.current.className,
                    disabledClassName,
                );
            } else {
                const classNames = mapContainerRef.current.className.split(' ');
                const filteredClassNames = classNames.filter((name) => name !== disabledClassName);
                mapContainerRef.current.className = _cs(...filteredClassNames);
            }
        },
        [mapContainerRef, disabled],
    );

    return null;
};


MapShapeEditor.defaultProps = {
    geoJsons: [],
    disabled: false,
};

export default MapShapeEditor;
