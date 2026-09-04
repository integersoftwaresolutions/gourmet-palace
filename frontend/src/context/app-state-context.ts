import { createContext } from 'react'
import type { Location } from '../lib/api'
export type DatePreset='yesterday'|'7d'|'30d'|'wtd'|'mtd'|'ytd'|'custom'
export type ComparisonMode='previous'|'prior-year'
export type AppStateValue={
  locations:Location[];selectedLocationId:string;setSelectedLocationId:(v:string)=>void;
  datePreset:DatePreset;setDatePreset:(v:DatePreset)=>void;
  customFrom:string;setCustomFrom:(v:string)=>void;customTo:string;setCustomTo:(v:string)=>void;
  comparisonMode:ComparisonMode;setComparisonMode:(v:ComparisonMode)=>void;
  theme:'dark'|'light';setTheme:(v:'dark'|'light')=>void;refreshLocations:()=>Promise<void>;query:Record<string,string>
}
export const AppStateContext=createContext<AppStateValue|null>(null)
