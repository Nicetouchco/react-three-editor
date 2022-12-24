/* eslint-disable react-hooks/rules-of-hooks */
import { useHelper } from "@react-three/drei"
import { LevaInputs } from "leva"
import { StoreType } from "leva/dist/declarations/src/types"
import { mergeRefs } from "leva/plugin"
import { Dispatch, SetStateAction, useEffect, useState } from "react"
import { toast } from "react-hot-toast"
import { Event, Object3D } from "three"
import { PropType } from "../fiber/prop-types/core/createProp"
import { JSXSource } from "../types"
import { createLevaStore } from "./controls/createStore"
import { helpers } from "./controls/helpers"
import { Editor } from "./Editor"

/**
 * An editable element is a wrapper around a React element that can be edited in the editor.
 *
 * Ideally, a subset of your React app would be wrapped in editable elements, maybe just React components
 * and not the primitives. Depends on your use case.
 *
 * This element is tightly integrated with the editor, and is not meant to be used outside of it.
 *
 * It contains all information about the React element that was rendered by it, including refs, props,
 * hooks into the render cycle, place in the react tree compared to other editable elements, etc.
 *
 * It also contains a leva store, which is used to edit the props of the element. It can be rendered using a
 * leva panel, or a custom UI.
 *
 * It tracks changes to the props, and can be used to update the React element. Furthermore, it can be used to
 * write the changes to you React code base, so that you don't have to copy and paste your changes from some devtools
 * and you don't loose control of your code.
 *
 * */
export class EditableElement<
  Ref extends { name?: string; visible?: boolean } = any
> extends EventTarget {
  useName() {
    return this.store?.useStore((s) => s.data["name"].value)
  }
  useChildren() {
    return this.editor.store((s) => [...(s.elements[this.id]?.children ?? [])])
  }
  useIsDirty() {
    return this.store?.useStore((s) => Object.keys(this.changes).length > 0)
  }
  setPropValue({
    object,
    type,
    prop,
    value,
    input,
    path,
    controlPath,
    onChange,
    closestEditable
  }: {
    controlPath: string
    object: any
    prop: string
    input: any
    type: PropType
    path: string[]
    closestEditable?: EditableElement
    value: any
    onChange?: (value: any, controlPath: string) => void
  }) {
    onChange?.(value, controlPath)

    let serializale = type.serialize
      ? type.serialize(object, prop, input)
      : value

    // prop thats not serializable is not editable
    // since we cant do anything with the edited prop
    if (serializale !== undefined && this instanceof EditableElement) {
      if (closestEditable) {
        if (this === closestEditable) {
          let [_, ...p] = path
          this.addChange(this, p.join("-"), serializale)
          this.changed = true
          let propOveride = setValue

          if (propOveride !== undefined) {
            editableElement.setProp(p.join("-"), propOveride)
          }
        } else {
          editableElement.addChange(
            closestEditable,
            remaining.join("-"),
            serializale
          )
          editableElement.changed = true
        }
      } else {
        let [_, ...p] = path
        editableElement.addChange(editableElement, p.join("-"), serializale)
        editableElement.changed = true

        let propOveride = type.override
          ? type.override(object, prop, serializale)
          : serializale

        if (propOveride !== undefined) {
          editableElement.setProp(p.join("-"), propOveride)
        }
      }
    }
  }

  delete() {
    this.refs.deleted = true
    this.render()
  }

  get deleted() {
    return this.refs.deleted
  }
  ref?: Ref
  childIds: string[] = []
  changes: Record<string, Record<string, any>> = {}
  props: any = {}
  forwardedRef: boolean = false
  dirty: any = false
  store: StoreType | null = createLevaStore()
  editor: Editor = {} as any
  object?: Object3D<Event>

  constructor(
    public id: string,
    public source: JSXSource,
    public type: any,
    public parentId?: string | null,
    public currentProps: any = {}
  ) {
    super()
  }

  index: string | undefined

  refs = {
    setKey: null as Dispatch<SetStateAction<number>> | null,
    forceUpdate: null as Dispatch<SetStateAction<number>> | null,
    setMoreChildren: null as Dispatch<SetStateAction<any[]>> | null,
    deleted: false
  }

  mounted: boolean = false

  remount() {
    this.refs.setKey?.((i) => i + 1)
  }

  render() {
    this.refs.forceUpdate?.((i) => i + 1)
  }

  update(source: JSXSource, props: any) {
    this.source = source
    this.currentProps = { ...props }

    if (this.store?.get("name") !== this.displayName) {
      this.store?.setValueAtPath("name", this.displayName, true)
    }
  }

  useRenderState(forwardRef?: any) {
    const [key, setSey] = useState(0)
    const [_, forceUpdate] = useState(0)
    const [mounted, setMounted] = useState(false)
    const [moreChildren, setMoreChildren] = useState<any>([])
    this.refs.setKey = setSey
    this.refs.forceUpdate = forceUpdate
    this.forwardedRef = forwardRef ? true : false
    this.refs.setMoreChildren = setMoreChildren
    this.mounted = mounted

    // useState so that this runs only once when the item is created
    useState(() => {
      this.store?.addData(
        {
          name: {
            value: this.displayName,
            type: LevaInputs.STRING,
            label: "name",
            render: () => false
          }
        } as any,
        false
      )
    })

    return {
      ref: mergeRefs([
        forwardRef === true ? null : forwardRef,
        (el: any) => {
          if (el) {
            this.setRef(el)
          }
        },
        (el) => setMounted(true)
      ]),
      mounted,
      moreChildren,
      key
    }
  }

  get treeId(): string {
    return this.parent?.index !== undefined
      ? this.parent.treeId + "-" + this.index
      : this.index!
  }

  get current() {
    return this.ref
  }

  get key() {
    if (this.source.moduleName === this.source.componentName) {
      return `${this.source.componentName}:${this.elementName}:${this.source.lineNumber}:${this.source.columnNumber}`
    }
    return `${this.source.moduleName}:${this.source.componentName ?? "_"}:${
      this.elementName
    }:${this.source.lineNumber}:${this.source.columnNumber}`
  }

  get name() {
    return this.ref?.name?.length ? this.ref.name : this.key
  }

  setRef(el: Ref) {
    this.ref = el
    this.editor.setRef(this, el)
    this.dispatchEvent(
      new CustomEvent("ref-changed", {
        detail: {
          ref: el
        }
      })
    )
  }

  setObject3D(item: Object3D<Event>) {
    this.object = item
  }

  getObject3D() {
    return this.object || this.ref
  }

  isObject3D() {
    return this.object || this.ref instanceof Object3D
  }

  resetControls() {}

  get elementName() {
    return this.source.elementName
      ? this.source.elementName
      : typeof this.type === "string"
      ? this.type
      : this.type.displayName || this.type.name
  }

  get displayName() {
    let componentName = this.source.componentName
    let elementName = this.elementName
    let remainingSlot = 30 - this.elementName.length

    if (this.ref?.name?.length && this.ref.name !== this.key) {
      return this.ref.name
    }

    if (this.currentProps["name"]) {
      return this.currentProps["name"]
    }

    if (componentName) {
      return `${
        componentName.length > remainingSlot
          ? componentName.slice(0, remainingSlot) + "…"
          : componentName
      }.${elementName}`
    }

    return elementName
  }

  get visible() {
    return this.ref?.visible ?? true
  }

  set visible(v: boolean) {
    if (this.ref) {
      this.ref.visible = v
    }
  }

  useVisible() {
    const [visible, setVisible] = useState(true)
    return [visible, setVisible] as const
  }

  useIsSelected() {
    return this.editor.useState((state) => state.context.selectedId === this.id)
  }

  useHelper(arg0: string, helper: any, ...args: any[]) {
    const [props] = this.editor.useSettings("helpers", {
      [arg0]: helpers({
        label: arg0
      })
    }) as [any]

    const isSelected = this.useIsSelected()

    let ref =
      props[arg0] === "all"
        ? this
        : props[arg0] === "selected" && isSelected
        ? this
        : undefined

    // @ts-ignore
    useHelper(ref as any, helper, ...(args ?? []))
  }

  useCollapsed(): [any, any] {
    let storedCollapsedState =
      this.editor.expanded.size > 0
        ? this.editor.expanded.has(this.treeId)
          ? false
          : true
        : !this.editor.isSelected(this) && this.isPrimitive()

    const [collapsed, setCollapsed] = useState(storedCollapsedState)

    useEffect(() => {
      if (collapsed) {
        this.editor.expanded.delete(this.treeId)
        localStorage.setItem(
          "collapased",
          JSON.stringify(Array.from(this.editor.expanded))
        )
      } else {
        this.editor.expanded.add(this.treeId)
        localStorage.setItem(
          "collapased",
          JSON.stringify(Array.from(this.editor.expanded))
        )
      }
    }, [collapsed])

    return [collapsed, setCollapsed]
  }

  isPrimitive(): boolean {
    return (
      this.elementName.charAt(0) === this.elementName.charAt(0).toLowerCase() &&
      !(this.elementName === "group")
    )
  }

  addChange(element: EditableElement, prop: string, value: any) {
    if (!this.changes[element.id]) {
      this.changes[element.id] = { _source: element.source }
    }
    this.changes[element.id][prop] = value
  }

  get changed() {
    let data = this.store?.getData()!
    if (data && data["save"]) {
      return !(data["save"] as any).settings.disabled
    }

    return this.dirty
  }

  set changed(value) {
    let data = this.store?.getData()!
    if (data && data["save"]) {
      this.store?.setSettingsAtPath("save", {
        disabled: !value
      })
    } else {
      this.store?.useStore.setState((s) => ({ ...s }))
    }

    this.dirty = value
  }

  changeProp(arg0: string, arg1: number[]) {
    this.addChange(this, arg0, arg1)
    this.changed = true
    this.setProp(arg0, arg1)
  }

  setProp(arg0: string, arg1: any) {
    if (!this.forwardedRef || this.type !== "string" || arg0 === "args") {
      this.props[arg0] = arg1
      this.render()
    }
  }

  get controls() {
    let controls = {}
    let entity = this

    this.editor.plugins.forEach((plugin) => {
      if (plugin.controls && plugin.applicable(entity)) {
        Object.assign(controls, plugin.controls(entity))
      }
    })

    return controls
  }

  get icon() {
    for (var i = this.editor.plugins.length - 1; i >= 0; i--) {
      let plugin = this.editor.plugins[i]
      if (plugin.icon && plugin.applicable(this)) {
        return plugin.icon(this)
      }
    }

    return "ph:cube"
  }

  async save() {
    let diffs = Object.values(this.changes).map(({ _source, ...value }) => ({
      action_type: "updateAttribute",
      value,
      source: _source
    }))

    console.debug(diffs)

    try {
      console.log(await this.editor.save(diffs))
      this.changes = {}
      this.changed = false
    } catch (e) {
      toast.error("Error saving: " + e.message)
      console.error(e)
    }

    // this.openInEditor()
  }

  async openInEditor() {
    fetch(
      `/__open-in-editor?file=${encodeURIComponent(
        `${this.source.fileName}:${this.source.lineNumber}:${
          this.source.columnNumber + 1
        }`
      )}`
    )
  }

  get children() {
    return this.childIds
      .map((id) => this.editor.getElementById(id)!)
      .filter(Boolean)
  }

  get parent() {
    return this.editor.getElementById(this.parentId!)
  }

  getObjectByPath<T>(path: string[]): T {
    let el: any = this
    for (let i = 0; i < path.length; i++) {
      el = el?.[path[i]]
    }
    return el
  }

  getEditableObjectByPath(path: string[]) {
    let el: any = this
    let editable: any = this
    let remainingPath = path
    if (path.length > 1) {
      for (let i = 0; i < path.length - 1; i++) {
        el = el?.[path[i]]
        let edit = this.editor.findEditableElement(el)
        if (edit) {
          editable = edit
          remainingPath = path.slice(i + 1)
        }
      }
    }
    return [el, editable, remainingPath]
  }
}

class R3fEditabelElement {}
