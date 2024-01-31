import type { IUrlOptions } from '../helpers';
import type {
    IConnectorProxyRefreshed,
    IConnectorToRefresh,
    IProxyToConnect,
    IProxyToRefresh,
} from '@scrapoxy/common';
import type { ISockets } from '@scrapoxy/proxy-sdk';
import type {
    ClientRequestArgs,
    OutgoingHttpHeaders,
} from 'http';
import type { Socket } from 'net';


export interface ITransportService {
    type: string;

    completeProxyConfig: (proxy: IConnectorProxyRefreshed, connector: IConnectorToRefresh) => void;

    buildRequestArgs: (
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: OutgoingHttpHeaders,
        headersConnect: OutgoingHttpHeaders,
        proxy: IProxyToConnect,
        sockets: ISockets,
        timeout: number
    ) => ClientRequestArgs;

    buildFingerprintRequestArgs: (
        method: string | undefined,
        urlOpts: IUrlOptions,
        headers: OutgoingHttpHeaders,
        headersConnect: OutgoingHttpHeaders,
        proxy: IProxyToRefresh,
        sockets: ISockets,
        timeout: number
    ) => ClientRequestArgs;

    connect: (
        url: string,
        headers: OutgoingHttpHeaders,
        proxy: IProxyToConnect,
        sockets: ISockets,
        timeout: number,
        callback: (err: Error, socket: Socket) => void
    ) => void;
}
