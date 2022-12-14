import { Components, createPlugin, useInputContext } from "leva/plugin"
import React, { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  DropZone,
  ImageContainer,
  ImageLargePreview,
  ImagePreview,
  Instructions,
  Remove
} from "../../editable/controls/image"
import { usePopin } from "../../editable/controls/usePopin"

export const texture = createPlugin({
  sanitize(value: any) {
    if (value instanceof File) {
      return URL.createObjectURL(value)
    }
    return value
  },
  component() {
    const { label, value, onUpdate, disabled } = useInputContext()
    const { popinRef, wrapperRef, shown, show, hide } = usePopin()

    const onDrop = useCallback(
      async (acceptedFiles: File[]) => {
        console.log(acceptedFiles)
        if (acceptedFiles.length) {
          let data = new FormData()
          data.append("file", acceptedFiles[0])
          let response = await fetch(
            `/__editor/save/${acceptedFiles[0].name}`,
            {
              method: "POST",
              body: data
            }
          )
          let json = await response.json()
          onUpdate(json)
        }
      },
      [onUpdate]
    )

    const clear = useCallback(
      (e: MouseEvent) => {
        e.stopPropagation()
        onUpdate(undefined)
      },
      [onUpdate]
    )

    const { getRootProps, getInputProps, isDragAccept } = useDropzone({
      maxFiles: 1,
      accept: { "image/*": [] },
      onDrop,
      disabled
    })

    return (
      <Components.Row input>
        <Components.Label>{label}</Components.Label>
        <ImageContainer>
          <ImagePreview
            ref={popinRef}
            hasImage={!!value}
            onPointerDown={() => !!value && show()}
            onPointerUp={hide}
            style={{ backgroundImage: value ? `url(${value})` : "none" }}
          />
          {shown && !!value && (
            <Components.Portal>
              <Components.Overlay
                onPointerUp={hide}
                style={{ cursor: "pointer" }}
              />
              <ImageLargePreview
                ref={wrapperRef}
                style={{ backgroundImage: `url(${value})` }}
              />
            </Components.Portal>
          )}
          <DropZone {...(getRootProps({ isDragAccept }) as any)}>
            <input {...getInputProps()} />
            <Instructions>
              {isDragAccept ? "drop image" : "click or drop"}
            </Instructions>
          </DropZone>
          <Remove onClick={clear} disabled={!value} />
        </ImageContainer>
      </Components.Row>
    )
  }
})
