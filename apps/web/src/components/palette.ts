import { createContext, useContext } from 'react'
import { RAINBOW } from '../viz/palettes'

/** The ten digit colours of the active palette (index = digit). */
export const PaletteContext = createContext<readonly string[]>(RAINBOW)

export const useDigitColors = () => useContext(PaletteContext)
