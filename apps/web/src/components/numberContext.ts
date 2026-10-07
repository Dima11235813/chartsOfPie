import { createContext, useContext } from 'react'
import { getSeries, type SeriesDefinition } from '../core/series/series'

/** The number playing (π unless another is chosen): its symbol goes into labels such as "π walk". */
export const NumberContext = createContext<SeriesDefinition>(getSeries('pi'))

export const useNumber = () => useContext(NumberContext)
