import { useContext, useEffect, useRef } from 'react';

import { MapChildContext } from './context';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

interface Props {
    ordering: string[] | undefined;
}

const MapOrder = (props: Props) => {
    const { map } = useContext(MapChildContext);
    const {
        ordering,
    } = props;

    const timeoutRef = useRef<number | undefined>();

    useEffect(
        () => {
            if (!map || !ordering) {
                return noop;
            }

            // NOTE: To ensure layers are mounted, we use setTimeout
            timeoutRef.current = window.setTimeout(
                () => {
                    // NOTE: just to be safe, only try ordering layers that are mounted
                    const validLayerIdentifiers = ordering.filter(
                        (layerIdentifier) => !!map.getLayer(layerIdentifier),
                    );

                    for (let i = 0; i < validLayerIdentifiers.length; i += 1) {
                        for (let j = i + 1; j < validLayerIdentifiers.length; j += 1) {
                            // NOTE: Moving layer with index j before layer i
                            map.moveLayer(validLayerIdentifiers[i], validLayerIdentifiers[j]);
                        }
                    }
                },
                0,
            );

            return () => {
                window.clearTimeout(timeoutRef.current);
            };
        },
        [map, ordering],
    );

    return null;
};


MapOrder.defaultProps = {
};

export default MapOrder;
