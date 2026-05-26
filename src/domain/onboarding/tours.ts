import type { TranslationKey } from "@/i18n";

export interface TourStep {
  bodyKey: TranslationKey;
  target: string;
  titleKey: TranslationKey;
}

export interface TourDefinition {
  id: string;
  steps: TourStep[];
}

export const TOUR_DEFINITIONS: TourDefinition[] = [
  {
    id: "dashboard",
    steps: [
      {
        bodyKey: "onboarding.tour.dashboard.step1.body",
        target: '[data-tour="dashboard-kpis"]',
        titleKey: "onboarding.tour.dashboard.step1.title",
      },
      {
        bodyKey: "onboarding.tour.dashboard.step2.body",
        target: '[data-tour="dashboard-shortcuts"]',
        titleKey: "onboarding.tour.dashboard.step2.title",
      },
      {
        bodyKey: "onboarding.tour.dashboard.step3.body",
        target: '[data-tour="getting-started-checklist"]',
        titleKey: "onboarding.tour.dashboard.step3.title",
      },
    ],
  },
  {
    id: "products",
    steps: [
      {
        bodyKey: "onboarding.tour.products.step1.body",
        target: '[data-tour="products-add"]',
        titleKey: "onboarding.tour.products.step1.title",
      },
      {
        bodyKey: "onboarding.tour.products.step2.body",
        target: '[data-tour="products-import"]',
        titleKey: "onboarding.tour.products.step2.title",
      },
    ],
  },
  {
    id: "customers",
    steps: [
      {
        bodyKey: "onboarding.tour.customers.step1.body",
        target: '[data-tour="customers-add"]',
        titleKey: "onboarding.tour.customers.step1.title",
      },
    ],
  },
  {
    id: "invoices",
    steps: [
      {
        bodyKey: "onboarding.tour.invoices.step1.body",
        target: '[data-tour="invoices-new"]',
        titleKey: "onboarding.tour.invoices.step1.title",
      },
    ],
  },
  {
    id: "pos",
    steps: [
      {
        bodyKey: "onboarding.tour.pos.step1.body",
        target: '[data-tour="pos-add-product"]',
        titleKey: "onboarding.tour.pos.step1.title",
      },
      {
        bodyKey: "onboarding.tour.pos.step2.body",
        target: '[data-tour="pos-complete"]',
        titleKey: "onboarding.tour.pos.step2.title",
      },
    ],
  },
  {
    id: "purchases",
    steps: [
      {
        bodyKey: "onboarding.tour.purchases.step1.body",
        target: '[data-tour="purchases-new"]',
        titleKey: "onboarding.tour.purchases.step1.title",
      },
    ],
  },
  {
    id: "app-shell",
    steps: [
      {
        bodyKey: "onboarding.tour.shell.step1.body",
        target: '[data-tour="sidebar-nav"]',
        titleKey: "onboarding.tour.shell.step1.title",
      },
      {
        bodyKey: "onboarding.tour.shell.step2.body",
        target: '[data-tour="command-palette"]',
        titleKey: "onboarding.tour.shell.step2.title",
      },
      {
        bodyKey: "onboarding.tour.shell.step3.body",
        target: '[data-tour="help-menu"]',
        titleKey: "onboarding.tour.shell.step3.title",
      },
    ],
  },
];

const tourMap = new Map(TOUR_DEFINITIONS.map((tour) => [tour.id, tour]));

export function getTour(id: string): TourDefinition | undefined {
  return tourMap.get(id);
}

export function tourIdForPath(pathname: string): string | null {
  if (pathname === "/dashboard" || pathname === "/") {
    return "dashboard";
  }
  if (pathname.startsWith("/products")) {
    return "products";
  }
  if (pathname.startsWith("/customers")) {
    return "customers";
  }
  if (pathname.startsWith("/invoices")) {
    return "invoices";
  }
  if (pathname.startsWith("/pos")) {
    return "pos";
  }
  if (pathname.startsWith("/purchases")) {
    return "purchases";
  }
  return null;
}
