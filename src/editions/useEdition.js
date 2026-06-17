// useEdition — the hook every screen uses to ask "which edition is this
// dynasty, and what does it enable?"
//
// Reads the current dynasty from DynastyContext and resolves its edition
// config. Components should consume `config.features.*` and (later)
// `config.*` rule values from here, NEVER compare the edition key
// directly — that keeps all edition awareness in the data layer and makes
// new editions a no-touch change for shared UI.
//
//   const { config, features, isCfb27 } = useEdition()
//   {features.dynastyPoints && <ProgramOverview />}

import { useMemo } from 'react'
import { useDynasty } from '../context/DynastyContext'
import { getEditionKey, getEditionConfig } from './index'

export function useEdition(dynastyOverride) {
  const { currentDynasty } = useDynasty()
  const dynasty = dynastyOverride ?? currentDynasty

  return useMemo(() => {
    const key = getEditionKey(dynasty)
    const config = getEditionConfig(key)
    return {
      key,
      config,
      features: config?.features ?? {},
      // Small convenience flags for readability at call sites. These check
      // the resolved key, which is fine here (this hook IS the edition
      // boundary); downstream UI should still prefer `features.*`.
      isCfb26: key === 'cfb26',
      isCfb27: key === 'cfb27',
    }
  }, [dynasty])
}
