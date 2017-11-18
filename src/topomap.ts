/**
 * Remove me.
 */

/*tslint:disable*/

import { PkgJson, Dict } from './workspace'
import { flatMap, uniq } from 'lodash'

const cacheMap = new WeakMap()

function cached(_obj: any, key: string, desc: PropertyDescriptor) {
  const getter = desc.get

  desc.get = function() {
    let cache = cacheMap.get(this)
    if (cache == null) cacheMap.set(this, (cache = {}))

    let prop = cache[key]
    if (prop == null) {
      prop = cache[key] = { computing: true }
      try {
        prop.val = getter && getter.call(this)
      } finally {
        prop.computing = false
      }
    } else if (prop.computing) {
      throw new Error('Cycle detected!')
    }
    return prop.val
  }
}

export class PackageMap {
  map: Map<string, Package>
  constructor(jsons: PkgJson[]) {
    this.map = new Map()
    jsons.forEach(json => {
      this.map.set(json.name, new Package(json, this))
    })
  }

  @cached
  get topoMap() {
    return Array.from(this.map.keys()).map(k => {
      const val = this.map.get(k)
      if (!val) {
        throw Error(`Not found: ${k}`)
      }
      return {
        name: k,
        order: val.order,
        cycle: val.cycle
      }
    })
  }
}

export class Package {
  depNames: string[]
  list: PackageMap
  cycle: boolean
  name: string

  constructor(json: PkgJson, list: PackageMap) {
    this.name = json.name
    this.depNames = (json.dependencies && Object.keys(json.dependencies)) || []
    this.list = list
    this.cycle = false
  }

  @cached
  get dependencies(): Package[] {
    return this.depNames.map(n => this.list.map.get(n)!).filter(p => p)
  }

  @cached
  get deepDependencies(): string[] {
    try {
      let deeper = uniq(flatMap(this.dependencies, d => d.deepDependencies))
      deeper.push(this.name)
      return deeper
    } catch (e) {
      // already computing this pkg's deepDeps
      return []
    }
  }

  @cached
  get order() {
    if (this.dependencies.length === 0) return 1
    return (
      this.dependencies.reduce((acc, el) => {
        let order = 0
        try {
          order = (el as any).order // not sure that throws here
        } catch (e) {
          this.cycle = true
        }
        return Math.max(acc, order)
      }, 0) + 1
    )
  }
}

export function buildOrder(pkgs: PkgJson[]) {
  const orders = []
  while (pkgs.length > 0) {
    const newStuff = new PackageMap(pkgs).topoMap
    orders.push(newStuff)
    const cycled = newStuff.reduce(
      (acc, el) => {
        acc[el.name] = el.cycle
        return acc
      },
      {} as Dict<boolean>
    )
    pkgs = pkgs.filter(p => cycled[p.name])
  }
  return orders
}

export function subsetBuildOrder(pkgs: PkgJson[], subset: string[]) {
  let pm = new PackageMap(pkgs)
  let subsetDeps = flatMap(subset, p => pm.map.get(p)!.deepDependencies)
  let subsetJsons = pkgs.filter(p => subsetDeps.indexOf(p.name))
  return buildOrder(subsetJsons)[0]
}
