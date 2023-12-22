import { Logger } from '@nestjs/common';
import {
    CommanderApp,
    MasterApp,
    TestServers,
    waitFor,
} from '@scrapoxy/backend-test-sdk';
import {
    CloudlocalApp,
    SUBSCRIPTION_LOCAL_DEFAULTS,
} from '@scrapoxy/cloudlocal';
import {
    ONE_MINUTE_IN_MS,
    ONE_SECOND_IN_MS,
    sleep,
} from '@scrapoxy/common';
import { CONNECTOR_CLOUDLOCAL_TYPE } from '@scrapoxy/connector-cloudlocal-sdk';
import { v4 as uuid } from 'uuid';
import type {
    IConnectorView,
    ICredentialView,
    IProjectData,
    IProjectToCreate,
} from '@scrapoxy/common';
import type {
    IConnectorCloudlocalConfig,
    IConnectorCloudlocalCredential,
} from '@scrapoxy/connector-cloudlocal-backend';


describe(
    'Commander - Proxies - Auto Rotate',
    () => {
        const logger = new Logger();
        const
            cloudlocalApp = new CloudlocalApp(logger),
            projectToCreate: IProjectToCreate = {
                name: 'myproject',
                autoRotate: false,
                autoRotateDelayRange: {
                    min: ONE_SECOND_IN_MS * 30,
                    max: ONE_SECOND_IN_MS * 30,
                },
                autoScaleUp: false,
                autoScaleDown: false,
                autoScaleDownDelay: ONE_SECOND_IN_MS * 30,
                cookieSession: true,
                mitm: true,
                proxiesMin: 1,
                useragentOverride: false,
            },
            servers = new TestServers();
        let
            commanderApp: CommanderApp,
            connector: IConnectorView,
            credential: ICredentialView,
            masterApp: MasterApp,
            project: IProjectData;

        beforeAll(async() => {
            // Start target & local connector
            await Promise.all([
                servers.listen(), cloudlocalApp.start(),
            ]);

            const subscriptionId = uuid();
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
            project = await commanderApp.frontendClient.createProject(projectToCreate);

            // Create credential
            const credentialConfig: IConnectorCloudlocalCredential = {
                subscriptionId,
            };

            credential = await commanderApp.frontendClient.createCredential(
                project.id,
                {
                    name: 'mycredential',
                    type: CONNECTOR_CLOUDLOCAL_TYPE,
                    config: credentialConfig,
                }
            );

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
                    proxiesMax: 1,
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
        });

        afterAll(async() => {
            await commanderApp.stop();

            await Promise.all([
                masterApp.stop(), cloudlocalApp.close(), servers.close(),
            ]);
        });

        let proxyId: string;
        it(
            'should have a proxy',
            async() => {
                await waitFor(async() => {
                    const view = await commanderApp.frontendClient.getAllConnectorProxiesById(
                        project.id,
                        connector.id
                    );
                    expect(view.proxies)
                        .toHaveLength(connector.proxiesMax);

                    proxyId = view.proxies[ 0 ].id;
                });
            }
        );

        it(
            'should wait 40 seconds and have the same proxy',
            async() => {
                await sleep(ONE_SECOND_IN_MS * 40);

                await waitFor(async() => {
                    const view = await commanderApp.frontendClient.getAllConnectorProxiesById(
                        project.id,
                        connector.id
                    );
                    expect(view.proxies)
                        .toHaveLength(connector.proxiesMax);

                    expect(view.proxies[ 0 ].id)
                        .toBe(proxyId);
                });
            },
            ONE_MINUTE_IN_MS
        );

        it(
            'should update autoRotate settings to ON',
            async() => {
                await commanderApp.frontendClient.updateProject(
                    project.id,
                    {
                        ...projectToCreate,
                        autoRotate: true,
                    }
                );

                await waitFor(async() => {
                    const projectFound = await commanderApp.frontendClient.getProjectById(project.id);
                    expect(projectFound.autoRotate)
                        .toBeTruthy();
                });
            }
        );

        it(
            'should have another proxy',
            async() => {
                await waitFor(async() => {
                    const view = await commanderApp.frontendClient.getAllConnectorProxiesById(
                        project.id,
                        connector.id
                    );
                    expect(view.proxies)
                        .toHaveLength(connector.proxiesMax);

                    expect(view.proxies[ 0 ].id).not.toBe(proxyId);
                });
            },
            ONE_MINUTE_IN_MS
        );
    }
);