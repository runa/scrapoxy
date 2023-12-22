import { NgModule } from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule,
} from '@angular/forms';
import {
    ButtonModule,
    FormModule,
    GridModule,
    TableModule,
    TooltipModule,
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import {
    ConnectorprovidersModule,
    FingerprintModule,
} from '@scrapoxy/frontend-sdk';
import { ConnectorProxyrackComponent } from './connector/connector.component';
import { CredentialProxyrackComponent } from './credential/credential.component';
import { ConnectorProxyrackFactory } from './proxyrack.factory';


@NgModule({
    imports: [
        ButtonModule,
        ConnectorprovidersModule,
        FormModule,
        FormsModule,
        GridModule,
        IconModule,
        TableModule,
        TooltipModule,
        ReactiveFormsModule,
        FingerprintModule,
    ],
    declarations: [
        ConnectorProxyrackComponent, CredentialProxyrackComponent,
    ],
    providers: [
        ConnectorProxyrackFactory,
    ],
})
export class ConnectorProxyrackModule {
    constructor(private readonly factory: ConnectorProxyrackFactory) {
        this.factory.init();
    }
}