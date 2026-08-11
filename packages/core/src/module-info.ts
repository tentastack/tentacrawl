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

// statically parsed by @tentacrawl/cli, so every field must be a literal;
// the module version is not one of them, it is read from package.json at runtime
export interface ModuleInfo {
  name: string;
  title: string;
  description: string;
  requires?: string[];
  optional?: string[];
  navigation?: ModuleNavigation;
  routes?: ModuleRoute[];
}
