import { Logger } from '@nestjs/common';
import {
    CommanderApp,
    CommanderScraperClient,
    MasterApp,
    TestServers,
    waitFor,
} from '@scrapoxy/backend-test-sdk';
import {
    CloudlocalApp,
    SUBSCRIPTION_LOCAL_DEFAULTS,
} from '@scrapoxy/cloudlocal';
import {
    countProxiesOnlineViews,
    EProjectStatus,
    IProxyView,
    ONE_MINUTE_IN_MS,
} from '@scrapoxy/common';
import { CONNECTOR_CLOUDLOCAL_TYPE } from '@scrapoxy/connector-cloudlocal-sdk';
import { v4 as uuid } from 'uuid';
import type {
    IConnectorView,
    IProjectData,
} from '@scrapoxy/common';
import type {
    IConnectorCloudlocalConfig,
    IConnectorCloudlocalCredential,
} from '@scrapoxy/connector-cloudlocal-backend';


describe(
    'Commander - Scrapers',
    () => {
        const logger = new Logger();
        const
            cloudlocalApp = new CloudlocalApp(logger),
            servers = new TestServers(),
            subscriptionId = uuid();
        let
            client: CommanderScraperClient,
            commanderApp: CommanderApp,
            connector: IConnectorView,
            masterApp: MasterApp,
            project: IProjectData;

        beforeAll(async() => {
            // Start target & local connector
            await Promise.all([
                servers.listen(), cloudlocalApp.start(),
            ]);

            await cloudlocalApp.client.createSubscription({
                id: subscriptionId,
                ...SUBSCRIPTION_LOCAL_DEFAULTS,
            });

            // Start app
            commanderApp = CommanderApp.defaults({
                cloudlocalAppUrl: cloudlocalApp.url,
                fingerprintUrl: servers.urlFingerprint,
                logger,
            });
            await commanderApp.start();
            masterApp = MasterApp.defaults({
                cloudlocalAppUrl: cloudlocalApp.url,
                commanderApp,
                fingerprintUrl: servers.urlFingerprint,
                logger,
            });
            await masterApp.start();

            // Create project
            project = await commanderApp.frontendClient.createProject({
                name: 'myproject',
                autoRotate: true,
                autoRotateDelayRange: {
                    min: ONE_MINUTE_IN_MS * 30,
                    max: ONE_MINUTE_IN_MS * 30,
                },
                autoScaleUp: true,
                autoScaleDown: true,
                autoScaleDownDelay: ONE_MINUTE_IN_MS,
                cookieSession: true,
                mitm: true,
                proxiesMin: 1,
                useragentOverride: false,
            });

            // Create credential
            const credentialConfig: IConnectorCloudlocalCredential = {
                subscriptionId,
            };
            const credential = await commanderApp.frontendClient.createCredential(
                project.id,
                {
                    name: 'mycredential',
                    type: CONNECTOR_CLOUDLOCAL_TYPE,
                    config: credentialConfig,
                }
            );

            await waitFor(async() => {
                await commanderApp.frontendClient.getCredentialById(
                    project.id,
                    credential.id
                );

                const token = await commanderApp.frontendClient.getProjectTokenById(project.id);
                client = new CommanderScraperClient(
                    commanderApp.url,
                    token
                );
            });

            // Create, install and activate connector
            const connectorConfig: IConnectorCloudlocalConfig = {
                region: 'europe',
                size: 'small',
                imageId: void 0,
            };
            connector = await commanderApp.frontendClient.createConnector(
                project.id,
                {
                    name: 'myconnector',
                    proxiesMax: 4,
                    credentialId: credential.id,
                    config: connectorConfig,
                    certificateDurationInMs: 10 * ONE_MINUTE_IN_MS,
                }
            );

            await commanderApp.frontendClient.installConnector(
                project.id,
                connector.id,
                {
                    config: {},
                }
            );

            await waitFor(async() => {
                const connectorFound = await commanderApp.frontendClient.getConnectorById(
                    project.id,
                    connector.id
                );
                const connectorConfigFound = connectorFound.config as IConnectorCloudlocalConfig;
                expect(connectorConfigFound.imageId?.length)
                    .toBeGreaterThan(0);
            });

            await commanderApp.frontendClient.activateConnector(
                project.id,
                connector.id,
                true
            );

            await waitFor(async() => {
                const views = await commanderApp.frontendClient.getAllProjectConnectorsAndProxiesById(project.id);
                expect(countProxiesOnlineViews(views))
                    .toBe(connector.proxiesMax);
            });
        });

        afterAll(async() => {
            await commanderApp.stop();

            await Promise.all([
                masterApp.stop(), cloudlocalApp.close(), servers.close(),
            ]);
        });

        it(
            'should get the current project',
            async() => {
                const projectFound = await client.getProject();

                expect(projectFound.id)
                    .toBe(project.id);

                expect(projectFound.status)
                    .toBe(project.status);
            }
        );

        let proxy: IProxyView;
        it(
            'should get all proxies with scraper token',
            async() => {
                const views = await client.getAllProjectConnectorsAndProxies();

                expect(views.length)
                    .toBe(1);

                const view = views[ 0 ];
                expect(view.proxies.length)
                    .toBe(connector.proxiesMax);

                proxy = view.proxies[ 0 ];
                expect(proxy.removing)
                    .toBeFalsy();
            }
        );

        it(
            'should remove a proxy',
            async() => {
                await client.askProxiesToRemove([
                    {
                        id: proxy.id,
                        force: false,
                    },
                ]);

                const views = await client.getAllProjectConnectorsAndProxies();
                const view = views[ 0 ];
                const proxyFound = view.proxies.find((p) => p.id === proxy.id);
                expect(proxyFound?.removing)
                    .toBeTruthy();
            }
        );

        it(
            'should change the project status',
            async() => {
                await client.setProjectStatus(EProjectStatus.CALM);

                const projectFound = await client.getProject();
                expect(projectFound.status)
                    .toBe(EProjectStatus.CALM);
            }
        );
    }
);