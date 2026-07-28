"use client";

import { CSSProperties, ReactNode, useEffect, useRef, useState } from "react";

const modalStack: symbol[] = [];

type AppModalProps = {
  children: ReactNode;
  onClose: () => void;
  dirty?: boolean;
  cardStyle?: CSSProperties;
  cardClassName?: string;
  backdropClassName?: string;
};

export default function AppModal({
  children,
  onClose,
  dirty = false,
  cardStyle,
  cardClassName = "",
  backdropClassName = ""
}: AppModalProps){
  const idRef = useRef(Symbol("app-modal"));
  const onCloseRef = useRef(onClose);
  const dirtyRef = useRef(dirty);
  const [confirmClose,setConfirmClose] = useState(false);

  useEffect(()=>{onCloseRef.current = onClose},[onClose]);
  useEffect(()=>{dirtyRef.current = dirty},[dirty]);

  useEffect(()=>{
    const id = idRef.current;
    modalStack.push(id);

    const onKeyDown = (event:KeyboardEvent)=>{
      if(event.key !== "Escape")return;
      if(modalStack[modalStack.length-1] !== id)return;
      event.preventDefault();
      if(confirmClose){
        setConfirmClose(false);
        return;
      }
      if(dirtyRef.current)setConfirmClose(true);
      else onCloseRef.current();
    };

    window.addEventListener("keydown",onKeyDown);
    return ()=>{
      window.removeEventListener("keydown",onKeyDown);
      const index = modalStack.lastIndexOf(id);
      if(index >= 0)modalStack.splice(index,1);
    };
  },[confirmClose]);

  function requestClose(){
    if(dirtyRef.current)setConfirmClose(true);
    else onCloseRef.current();
  }

  return <div
    className={`modal-backdrop ${backdropClassName}`.trim()}
    onMouseDown={event=>{
      if(event.target === event.currentTarget)requestClose();
    }}
  >
    <div
      className={`modal-card ${cardClassName}`.trim()}
      style={cardStyle}
      onMouseDown={event=>event.stopPropagation()}
      onClick={event=>{
        const target = event.target as HTMLElement;
        if(target.closest("[data-modal-close]")){
          event.preventDefault();
          requestClose();
        }
      }}
    >
      {children}
    </div>

    {confirmClose && <div className="modal-confirm-layer" onMouseDown={event=>event.stopPropagation()}>
      <div className="modal-confirm-card" role="dialog" aria-modal="true" aria-labelledby="modal-confirm-title">
        <p className="eyebrow">Cambios sin guardar</p>
        <h3 id="modal-confirm-title">¿Cerrar sin guardar?</h3>
        <p>Tienes cambios que todavía no se han guardado.</p>
        <div className="modal-confirm-actions">
          <button className="btn" onClick={()=>setConfirmClose(false)}>Seguir editando</button>
          <button className="btn red" onClick={()=>onCloseRef.current()}>Cerrar sin guardar</button>
        </div>
      </div>
    </div>}
  </div>;
}
