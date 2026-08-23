# Decision Summary

Recommended concept: separate `mcl-prototype-lab` repository.

Decision status: CONDITIONAL.

Why:
- current `MC_legends` is an active web/backend/deployment repository;
- root TypeScript and CI boundaries would couple embedded prototype code to production checks;
- Confluence says the web boilerplate is not the game architecture;
- MCL-1 is still open and blocks engine selection;
- asset-registry/provenance ideas already exist and transfer cleanly to prototype workflows.

Blocker for playability: no game runtime adapter may be selected under current governance.

Next decision: either resolve MCL-1 or approve a narrowly scoped disposable prototype-runtime exception. After that, run RESEARCH/ADAPTER_BUILD for one runtime and perform a dry run.
