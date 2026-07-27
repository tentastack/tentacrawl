export interface ModuleNavigation {
  label: string;
  icon: string;
  path: string;
  order: number;
  group?: string;
  // path of another module's navigation entry; nests this entry as its child
  parent?: string;
}

export interface ModuleRoute {
  path: string;
  page: string;
  title: string;
}

export interface ModuleInfo {
  name: string;
  title: string;
  version: string;
  description: string;
  requires?: string[];
  optional?: string[];
  navigation?: ModuleNavigation;
  routes?: ModuleRoute[];
}
