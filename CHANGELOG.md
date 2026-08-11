# Changelog

## [0.2.0](https://github.com/tentastack/tentacrawl/compare/v0.1.0...v0.2.0) (2026-08-11)


### ⚠ BREAKING CHANGES

* ModuleInfo no longer carries a version field. Modules reporting a version to the challenger registry must call readPackageVersion from @tentacrawl/core/module-version.

### Features

* **challenger:** report swallowed failures through a diagnostic port ([0b0e4d1](https://github.com/tentastack/tentacrawl/commit/0b0e4d10589df731d9024fa65e7dab2020d59eec))
* initial commit ([14419dd](https://github.com/tentastack/tentacrawl/commit/14419dd0922927a34586fa00d7dae671f6602440))
* introduce Challenger extension framework, rewrite proxy module ([ba39796](https://github.com/tentastack/tentacrawl/commit/ba397964c44c6d972785372b4158121d9efb66a9))


### Bug Fixes

* **cli:** fail on unresolved modules and flag version drift ([9080537](https://github.com/tentastack/tentacrawl/commit/90805370c51087e71241946db4d189e845090b86))
* **proxy:** derive extension identity from module metadata ([7bb8669](https://github.com/tentastack/tentacrawl/commit/7bb8669128d61db2ef8639a8334f32e0d3089b09))
* **scraper,crawler:** declare the challenger module dependency ([fa33402](https://github.com/tentastack/tentacrawl/commit/fa334021e8ed4d6ca36b5f7f35dae2a0fb1d77e7))


### Refactoring

* **browser:** drop the redundant ChallengerSource argument ([ecb7ead](https://github.com/tentastack/tentacrawl/commit/ecb7ead24c823b5f3a3119651dedb5f7d857d68c))


### Documentation

* tighten the comment rules in AGENTS.md ([6917407](https://github.com/tentastack/tentacrawl/commit/6917407eb2b213adb6c073934b1fd717e1b9ed7a))


### Continuous Integration

* add continuous integration and release automation ([c5f147e](https://github.com/tentastack/tentacrawl/commit/c5f147e7f08786a9b38f00204c3ddb6228b22638))
