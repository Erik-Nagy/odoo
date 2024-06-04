/** @odoo-module **/

import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { onWillStart, useState } from "@odoo/owl";
import { KanbanRenderer } from "@web/views/kanban/kanban_renderer";
import { useService } from "@web/core/utils/hooks";
import { useTrackedAsync } from "@point_of_sale/app/utils/hooks";
import { _t } from "@web/core/l10n/translation";
import { KanbanController } from "@web/views/kanban/kanban_controller";

async function updatePosKanbanViewState(orm, stateObj) {
    const result = await orm.call("pos.config", "get_pos_kanban_view_state");
    Object.assign(stateObj, result);
}

export class PosKanbanController extends KanbanController {
    static template = "point_of_sale.PosKanbanController";
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.initialPosState = {
            has_pos_config: true,
            has_chart_template: true,
            is_restaurant_installed: true,
            show_predefined_scenarios: true,
        };
        onWillStart(() => updatePosKanbanViewState(this.orm, this.initialPosState));
    }
}

export class PosKanbanRenderer extends KanbanRenderer {
    static template = "point_of_sale.PosKanbanRenderer";
    static props = [...KanbanRenderer.props, "initialPosState"];

    setup() {
        super.setup();
        this.orm = useService("orm");
        this.action = useService("action");
        this.posState = useState(this.props.initialPosState);
        this.loadScenario = useTrackedAsync(async ({ functionName, isRestaurant }) => {
            return await this.callWithViewUpdate(async () => {
                let isInstalledWithDemo = false;
                if (isRestaurant && !this.posState.is_restaurant_installed) {
                    const result = await this.orm.call("pos.config", "install_pos_restaurant");
                    isInstalledWithDemo = result.installed_with_demo;
                }
                if (!isInstalledWithDemo) {
                    await this.orm.call("pos.config", functionName);
                    await this.orm.call("pos.config", "hide_predefined_scenarios");
                }
            });
        });
        this.hidePredefinedScenarios = useTrackedAsync(async () => {
            return await this.callWithViewUpdate(async () =>
                this.orm.call("pos.config", "hide_predefined_scenarios")
            );
        });
    }

    async callWithViewUpdate(func) {
        try {
            await func();
            await updatePosKanbanViewState(this.orm, this.posState);
        } finally {
            this.env.searchModel.dispatchEvent(new CustomEvent("update"));
        }
    }

    get shopScenarios() {
        return [
            {
                name: _t("Clothes"),
                description: _t("Multi colors and sizes"),
                functionName: "load_onboarding_clothes_scenario",
                iconFile: "clothes-icon.png",
            },
            {
                name: _t("Furnitures"),
                description: _t("Stock, product configurator, replenishment, discounts"),
                functionName: "load_onboarding_furniture_scenario",
                iconFile: "furniture-icon.png",
            },
            {
                name: _t("Bakery"),
                description: _t("Food, but over the counter"),
                functionName: "load_onboarding_bakery_scenario",
                iconFile: "bakery-icon.png",
            },
        ];
    }

    get restaurantScenarios() {
        return [
            {
                name: _t("Restaurant"),
                isRestaurant: true,
                description: _t("Tables, menus, kitchen display, etc."),
                functionName: "load_onboarding_restaurant_scenario",
                iconFile: "restaurant-icon.png",
            },
            {
                name: _t("Bar"),
                isRestaurant: true,
                description: _t("Floor plan, tips, self order, etc."),
                functionName: "load_onboarding_bar_scenario",
                iconFile: "cocktail-icon.png",
            },
        ];
    }

    createNewProducts() {
        window.open("/web#action=point_of_sale.action_client_product_menu", "_self");
    }

    showTopBorder() {
        const { model } = this.props.list;
        return model.hasData();
    }

    get showNoContentHelper() {
        return false;
    }
}

export const PosKanbanView = {
    ...kanbanView,
    Renderer: PosKanbanRenderer,
    Controller: PosKanbanController,
};

registry.category("views").add("pos_config_kanban_view", PosKanbanView);
