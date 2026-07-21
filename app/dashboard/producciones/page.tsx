"use client";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useModulePermissions, permissionAlert } from "@/components/useModulePermissions";
import { Brand, ContentRequest, PlatformUser, Production, ReferenceFile, isImageFile, isVideoFile, listUniqueBrands, listProductions, listRequests, listUsers, organizationTeam, saveProduction, updateProduction, updateRequest, uploadReferenceFiles } from "@/lib/data";
import { authJsonHeaders } from "@/lib/client-auth";


type ProductionOrderSuggestion = {
  id: string;
  order: number;
  group: string;
  moment: string;
  priority: "normal" | "high" | "immediate" | string;
  requiresImmediateCapture: boolean;
  reason: string;
};

const empty: Production = {
  title: "",
  clientId: "",
  clientName: "",
  requestIds: [],
  objective: "",
  location: "",
  locations: "",
  scheduledDate: "",
  startTime: "",
  endTime: "",
  durationMinutes: 120,
  producer: "",
  team: "",
  teamMembers: [],
  shotList: "",
  requirements: "",
  notes: "",
  materialLinks: "",
  materialLinksByRequest: {},
  materialFiles: [],
  materialDueDate: "",
  materialDeliveredAt: "",
  status: "programada"
};

export default function ProductionsPage(){
  const [brands,setBrands]=useState<Brand[]>([]);
  const [requests,setRequests]=useState<ContentRequest[]>([]);
  const [productions,setProductions]=useState<Production[]>([]);
  const [users,setUsers]=useState<PlatformUser[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [form,setForm]=useState<Production>(empty);
  const [showModal,setShowModal]=useState(false);
  const [editing,setEditing]=useState<Production|null>(null);
  const [preview,setPreview]=useState<ReferenceFile|null>(null);
  const [brief,setBrief]=useState<Production|null>(null);
  const [pendingDetail,setPendingDetail]=useState<ContentRequest|null>(null);
  const [uploading,setUploading]=useState(false);
  const [requestSort,setRequestSort]=useState<{key:string;direction:"asc"|"desc"}>({key:"dueDate",direction:"asc"});
  const [productionSort,setProductionSort]=useState<{key:string;direction:"asc"|"desc"}>({key:"scheduledDate",direction:"asc"});
  const [collapsedProductionBatchIds,setCollapsedProductionBatchIds]=useState<string[]>([]);
  const [productionOrderReasons,setProductionOrderReasons]=useState<Record<string, ProductionOrderSuggestion>>({});
  const [productionOrderInstructions,setProductionOrderInstructions]=useState("");
  const [productionOrderMode,setProductionOrderMode]=useState<"manual"|"ai">("manual");
  const [orderingWithAi,setOrderingWithAi]=useState(false);
  const [dragProductionRequestId,setDragProductionRequestId]=useState<string|null>(null);

  const [reqClientFilter,setReqClientFilter]=useState("all");
  const [reqBatchFilter,setReqBatchFilter]=useState("all");
  const [reqStartDate,setReqStartDate]=useState("");
  const [reqEndDate,setReqEndDate]=useState("");

  const [prodClientFilter,setProdClientFilter]=useState("all");
  const [prodBatchFilter,setProdBatchFilter]=useState("all");
  const [prodStatusFilter,setProdStatusFilter]=useState("all");
  const [prodProducerFilter,setProdProducerFilter]=useState("all");
  const [prodMaterialFilter,setProdMaterialFilter]=useState("all");
  const [prodStartDate,setProdStartDate]=useState("");
  const [prodEndDate,setProdEndDate]=useState("");
  const [prodSearch,setProdSearch]=useState("");
  const permissions = useModulePermissions("producciones");
  const canCreateProduction = permissions.canCreate || permissions.canEdit;
  const canEditProduction = permissions.canEdit;

  async function load(){
    const [loadedBrands, loadedRequests, loadedProductions, loadedUsers] = await Promise.all([listUniqueBrands(), listRequests(), listProductions(), listUsers()]);
    setBrands(loadedBrands);
    setRequests(loadedRequests.filter(x=>x.status!=="eliminada"));
    setProductions(loadedProductions);
    setUsers(loadedUsers.filter(user=>user.status!=="inactive"));
  }
  useEffect(()=>{load()},[]);

  function inDateRange(value:string|undefined, start:string, end:string){
    if(!value)return true;
    if(start && value < start)return false;
    if(end && value > end)return false;
    return true;
  }

  function includesText(value:string|undefined, search:string){
    if(!search.trim())return true;
    return (value||"").toLowerCase().includes(search.trim().toLowerCase());
  }

  function toTitleCase(value:string){
    return (value||"").toLowerCase().replace(/\s+/g," ").trim().split(" ").map(part=>part ? part.charAt(0).toUpperCase()+part.slice(1) : "").join(" ");
  }

  function getUserArea(user:PlatformUser){
    return String(user.department || user.roleLabel || user.roleKey || "").toLowerCase();
  }

  function isProductionTeamName(name:string){
    const normalized = name.toLowerCase();
    const user = users.find(u=>toTitleCase(u.name||"").toLowerCase()===normalized || (u.email||"").toLowerCase()===normalized);
    if(user)return /audiovisual|producci[oó]n|editor|foto|video/.test(getUserArea(user));
    const member = organizationTeam.find(m=>toTitleCase(m.name).toLowerCase()===normalized);
    return member ? /audiovisual|producci[oó]n|editor|foto|video/.test(`${member.area} ${member.role}`.toLowerCase()) : true;
  }

  function addMinutesToTime(time:string, minutes:number){
    if(!time)return "";
    const [h,m] = time.split(":").map(Number);
    if(Number.isNaN(h)||Number.isNaN(m))return "";
    const total = h*60 + m + Number(minutes||0);
    const next = ((total % (24*60)) + (24*60)) % (24*60);
    return `${String(Math.floor(next/60)).padStart(2,"0")}:${String(next%60).padStart(2,"0")}`;
  }

  function durationLabel(minutes:number){
    const h=Math.floor(minutes/60);
    const m=minutes%60;
    return `${h?`${h} h`:""}${h&&m?" ":""}${m?`${m} min`:""}` || "0 min";
  }

  function isWeekendDate(value?:string){
    if(!value)return false;
    const date = new Date(`${value}T12:00:00`);
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  function safeProductionDate(k:keyof Production, value:string){
    if(value && isWeekendDate(value)){
      alert("No se pueden programar producciones ni entregas de material en sábado o domingo. Elige un día hábil.");
      return;
    }
    set(k,value);
  }

  function materialDueStatus(production:Production){
    if(production.status === "material_entregado") return {label:"Entregado", tone:"green"};
    if(!production.materialDueDate) return {label:"Sin fecha", tone:"orange"};
    const today = new Date().toISOString().slice(0,10);
    return production.materialDueDate < today ? {label:"Vencida", tone:"red"} : {label:"En tiempo", tone:"blue"};
  }

  const teamOptions = useMemo(()=>{
    // v8.1: Producción puede invitar a cualquier usuario activo: KAM, Content, Diseño, Dirección o Audiovisual.
    const fromUsers = users.map(user=>toTitleCase(user.name||"")).filter(Boolean);
    const fallback = organizationTeam.map(user=>toTitleCase(user.name));
    return Array.from(new Map([...fromUsers,...fallback].filter(Boolean).map(name=>[name.toLowerCase(),name])).values()).sort((a,b)=>a.localeCompare(b,"es"));
  },[users]);

  function getInternalDueDate(item:ContentRequest){return item.internalDueDate || item.dueDate || item.batchDueDate || "";}
  function getProductionDueDate(item:ContentRequest){return item.productionDueDate || getInternalDueDate(item) || item.publishDate || "";}
  function isVideoRequest(item:ContentRequest){
    const text = `${item.contentType} ${item.visualFormat || ""} ${item.feedPlacement || ""}`.toLowerCase();
    return /reel|video|tik|vertical|story/.test(text);
  }
  function requestTypeLabel(item:ContentRequest){return isVideoRequest(item) ? "Video" : "Estático / Foto";}
  function getLotSequenceNumber(item?:ContentRequest|null, fallbackIndex?:number){
    const raw = item?.lotSequenceNumber ?? item?.number ?? (typeof fallbackIndex === "number" ? fallbackIndex + 1 : undefined);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : "--";
  }
  function lotSequenceLabel(item?:ContentRequest|null, fallbackIndex?:number){
    return `Post #${getLotSequenceNumber(item,fallbackIndex)}`;
  }
  function productionOrderLabel(index:number){
    return `Orden producción ${index + 1}`;
  }
  function sortBy<T>(rows:T[], sort:{key:string;direction:"asc"|"desc"}, getter:(row:T,key:string)=>string|number){
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a,b)=>String(getter(a,sort.key)||"").localeCompare(String(getter(b,sort.key)||""),"es",{numeric:true})*direction);
  }
  function toggleRequestSort(key:string){setRequestSort(prev=>prev.key===key?{key,direction:prev.direction==="asc"?"desc":"asc"}:{key,direction:"asc"});}
  function toggleProductionSort(key:string){setProductionSort(prev=>prev.key===key?{key,direction:prev.direction==="asc"?"desc":"asc"}:{key,direction:"asc"});}

  const producerOptions = useMemo(()=>{
    const set = new Set(productions.map(x=>x.producer).filter(Boolean));
    return Array.from(set);
  },[productions]);

  const requestBatchOptions = useMemo(()=>{
    const map = new Map<string,string>();
    requests.filter(x=>x.requiresProduction).forEach(x=>map.set(x.batchId || "sin-lote", x.batchName || "Sin lote"));
    return Array.from(map.entries()).map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,"es"));
  },[requests]);

  const productionBatchOptions = useMemo(()=>{
    const requestById = new Map(requests.map(x=>[x.id,x]));
    const map = new Map<string,string>();
    productions.forEach(production=>{
      (production.requestIds || []).forEach(id=>{
        const req = requestById.get(id);
        if(req) map.set(req.batchId || "sin-lote", req.batchName || "Sin lote");
      });
    });
    return Array.from(map.entries()).map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,"es"));
  },[productions,requests]);

  const productionRequests = useMemo(()=>{
    const rows = requests.filter(x=> x.requiresProduction && !x.productionId &&
      (reqClientFilter==="all" || x.clientId===reqClientFilter) &&
      (reqBatchFilter==="all" || (x.batchId || "sin-lote")===reqBatchFilter) &&
      inDateRange(getInternalDueDate(x),reqStartDate,reqEndDate)
    );
    return sortBy(rows,requestSort,(row,key)=>{
      if(key==="batch")return row.batchName || "";
      if(key==="request")return `${row.clientName} ${row.contentType} ${row.objective} ${row.creativeIdea}`;
      if(key==="notes")return row.productionNotes || "";
      if(key==="publishDate")return row.publishDate || "";
      if(key==="kind")return requestTypeLabel(row);
      return getInternalDueDate(row);
    });
  },[requests,reqClientFilter,reqBatchFilter,reqStartDate,reqEndDate,requestSort]);

  const filteredProductions = useMemo(()=>{
    const requestById = new Map(requests.map(req=>[req.id,req]));
    const rows = productions.filter(x=>{
      const text = `${x.title} ${x.clientName} ${x.location} ${x.locations||""} ${x.producer} ${x.team} ${x.notes} ${x.materialDueDate||""}`.toLowerCase();
      const batchIds = new Set((x.requestIds || []).map(id=>requestById.get(id)?.batchId || "sin-lote"));
      const hasGeneralMaterial = Boolean((x.materialLinks||"").trim()) || Boolean((x.materialFiles||[]).length);
      const hasAnyPostMaterial = Boolean(Object.values(x.materialLinksByRequest||{}).some(v=>String(v||"").trim()));
      const hasMaterial = hasGeneralMaterial || hasAnyPostMaterial;
      return (prodClientFilter==="all" || x.clientId===prodClientFilter) &&
        (prodBatchFilter==="all" || batchIds.has(prodBatchFilter)) &&
        (prodStatusFilter==="all" || x.status===prodStatusFilter) &&
        (prodProducerFilter==="all" || x.producer===prodProducerFilter) &&
        (prodMaterialFilter==="all" || (prodMaterialFilter==="with" ? hasMaterial : !hasMaterial)) &&
        inDateRange(x.scheduledDate,prodStartDate,prodEndDate) &&
        (!prodSearch.trim() || text.includes(prodSearch.trim().toLowerCase()));
    });
    return sortBy(rows,productionSort,(row,key)=>{
      if(key==="title")return row.title;
      if(key==="client")return row.clientName;
      if(key==="producer")return row.producer || "";
      if(key==="status")return row.status || "";
      if(key==="requests")return row.requestIds?.length || 0;
      if(key==="materialDueDate")return row.materialDueDate || "";
      return row.scheduledDate || "";
    });
  },[productions,requests,prodClientFilter,prodBatchFilter,prodStatusFilter,prodProducerFilter,prodMaterialFilter,prodStartDate,prodEndDate,prodSearch,productionSort]);

  const groupedProductionRequests = useMemo(()=>{
    const map = new Map<string,{id:string;name:string;clientName:string;items:ContentRequest[]}>();
    productionRequests.forEach(item=>{
      const id = item.batchId || "sin-lote";
      if(!map.has(id)){
        map.set(id,{
          id,
          name:item.batchName || "Sin lote",
          clientName:item.clientName || "Sin cliente",
          items:[]
        });
      }
      map.get(id)!.items.push(item);
    });
    return Array.from(map.values()).sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true}));
  },[productionRequests]);

  const visibleProductionRequestIds = useMemo(()=>productionRequests.map(x=>x.id).filter(Boolean) as string[],[productionRequests]);
  const allVisibleProductionSelected = visibleProductionRequestIds.length > 0 && visibleProductionRequestIds.every(id=>selected.includes(id));
  const requestById = useMemo(()=>new Map(requests.map(item=>[item.id,item])),[requests]);
  const selectedRequests = productionRequests.filter(x=>selected.includes(x.id!));
  const modalOrderedRequests = useMemo(()=>{
    const ids = form.requestIds || [];
    return ids.map(id=>requestById.get(id)).filter(Boolean) as ContentRequest[];
  },[form.requestIds,requestById]);

  function toggle(id:string){if(!canCreateProduction)return permissionAlert("seleccionar solicitudes para producción"); setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])}

  function toggleAllVisibleProductionRequests(checked:boolean){
    if(!canCreateProduction)return permissionAlert("seleccionar solicitudes para producción");
    if(checked){
      setSelected(Array.from(new Set([...selected,...visibleProductionRequestIds])));
    }else{
      setSelected(selected.filter(id=>!visibleProductionRequestIds.includes(id)));
    }
  }

  function toggleProductionBatchCollapse(id:string){
    setCollapsedProductionBatchIds(current=>current.includes(id) ? current.filter(value=>value!==id) : [...current,id]);
  }

  function toggleProductionBatchSelection(groupItems:ContentRequest[], checked:boolean){
    if(!canCreateProduction)return permissionAlert("seleccionar solicitudes del lote para producción");
    const ids = groupItems.map(item=>item.id).filter(Boolean) as string[];
    if(checked){
      setSelected(Array.from(new Set([...selected,...ids])));
    }else{
      setSelected(selected.filter(id=>!ids.includes(id)));
    }
  }

  function openModal(){
    if(!canCreateProduction)return permissionAlert("crear producciones");
    if(!selected.length)return alert("Selecciona solicitudes para producción");
    const orderedIds = selectedRequests.map(item=>item.id).filter(Boolean) as string[];
    const first = selectedRequests[0];
    setProductionOrderReasons({});
    setProductionOrderInstructions("");
    setProductionOrderMode("manual");
    setForm({...empty,clientId:first.clientId,clientName:first.clientName,title:`Producción ${first.clientName} · ${new Date().toLocaleDateString("es-MX")}`,requestIds:orderedIds,objective:"",shotList:"",requirements:"",locations:""});
    setShowModal(true);
  }

  function set(k:keyof Production,v:any){
    if(!canCreateProduction)return;
    const next:any = {...form,[k]:v};
    if(k==="startTime" || k==="durationMinutes"){
      next.endTime = addMinutesToTime(k==="startTime" ? v : form.startTime, Number(k==="durationMinutes" ? v : form.durationMinutes || 120));
    }
    setForm(next);
  }

  function toggleTeamMember(name:string){
    if(!canCreateProduction)return permissionAlert("editar equipo de producción");
    const current = form.teamMembers || [];
    const next = current.includes(name) ? current.filter(item=>item!==name) : [...current,name];
    setForm({...form,teamMembers:next,team:next.join(", ")});
  }

  function reorderProductionRequestIds(nextIds:string[]){
    if(!canCreateProduction)return permissionAlert("ordenar producción");
    setProductionOrderMode("manual");
    setForm({...form,requestIds:nextIds,productionOrderMode:"manual"});
  }

  function moveProductionRequestByDrag(sourceId:string, targetId:string){
    if(!canCreateProduction)return permissionAlert("ordenar producción");
    if(!sourceId || !targetId || sourceId === targetId)return;
    const ids = [...(form.requestIds || [])];
    const fromIndex = ids.indexOf(sourceId);
    const toIndex = ids.indexOf(targetId);
    if(fromIndex < 0 || toIndex < 0)return;
    const [moved] = ids.splice(fromIndex,1);
    ids.splice(toIndex,0,moved);
    reorderProductionRequestIds(ids);
  }

  function quickSortProductionOrder(mode:"photo-first"|"video-first"|"keep-batch"){
    if(!canCreateProduction)return permissionAlert("ordenar producción");
    const ids = [...(form.requestIds || [])];
    const indexed = ids.map((id,index)=>({id,index,item:requestById.get(id)}));
    const sorted = indexed.sort((a,b)=>{
      if(mode === "photo-first"){
        const av = a.item ? isVideoRequest(a.item) : false;
        const bv = b.item ? isVideoRequest(b.item) : false;
        if(av !== bv)return av ? 1 : -1;
      }
      if(mode === "video-first"){
        const av = a.item ? isVideoRequest(a.item) : false;
        const bv = b.item ? isVideoRequest(b.item) : false;
        if(av !== bv)return av ? -1 : 1;
      }
      if(mode === "keep-batch"){
        const ab = a.item?.batchName || "";
        const bb = b.item?.batchName || "";
        const batchCompare = ab.localeCompare(bb,"es",{numeric:true});
        if(batchCompare)return batchCompare;
        const an = Number(a.item?.lotSequenceNumber ?? a.item?.number ?? a.index);
        const bn = Number(b.item?.lotSequenceNumber ?? b.item?.number ?? b.index);
        if(an !== bn)return an-bn;
      }
      return a.index-b.index;
    }).map(row=>row.id);
    reorderProductionRequestIds(sorted);
  }

  function removeFromProductionOrder(id:string){
    if(!canCreateProduction)return permissionAlert("editar orden de producción");
    setForm({...form,requestIds:(form.requestIds || []).filter(value=>value!==id)});
    setSelected(current=>current.filter(value=>value!==id));
    setProductionOrderReasons(current=>{const next={...current}; delete next[id]; return next;});
  }

  function applySuggestedProductionOrder(rows:ProductionOrderSuggestion[], mode:"manual"|"ai"){
    const validIds = new Set((form.requestIds || []));
    const ordered = rows
      .filter(row=>validIds.has(row.id))
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    const orderedIds = ordered.map(row=>row.id);
    const missing = (form.requestIds || []).filter(id=>!orderedIds.includes(id));
    const nextReasons:Record<string,ProductionOrderSuggestion> = {};
    ordered.forEach((row,index)=>{nextReasons[row.id] = {...row,order:index+1};});
    missing.forEach((id,index)=>{nextReasons[id] = {id,order:orderedIds.length+index+1,group:"Sin clasificar",moment:"Revisar manualmente",priority:"normal",requiresImmediateCapture:false,reason:"No se recibió sugerencia para esta solicitud; se mantiene al final para revisión."};});
    setProductionOrderReasons(nextReasons);
    setProductionOrderMode(mode);
    setForm({...form,requestIds:[...orderedIds,...missing],productionOrderMode:mode,productionOrderInstructions});
  }

  async function orderSelectionWithAi(){
    if(!canCreateProduction)return permissionAlert("ordenar producción con IA");
    if(!(form.requestIds || []).length)return alert("No hay solicitudes seleccionadas para ordenar.");
    setOrderingWithAi(true);
    try{
      const payloadItems = modalOrderedRequests.map(item=>({
        id:item.id,
        clientName:item.clientName,
        batchName:item.batchName,
        contentType:item.contentType,
        objective:item.objective,
        topic:item.topic,
        creativeIdea:item.creativeIdea,
        keyMessage:item.keyMessage,
        copyIn:item.copyIn,
        cta:item.cta,
        productionNotes:item.productionNotes,
        visualFormat:item.visualFormat,
        feedPlacement:item.feedPlacement,
        publishDate:item.publishDate,
        referenceLinks:item.referenceLinks,
        referenceFiles:item.referenceFiles,
        materialLinks:item.materialLinks,
        materialFiles:item.materialFiles,
        productionSpecificMaterialLink:item.productionSpecificMaterialLink,
        productionGeneralMaterialLinks:item.productionGeneralMaterialLinks,
        productionMaterialFiles:item.productionMaterialFiles
      }));
      const client = brands.find(brand=>brand.id===form.clientId) || null;
      const response = await fetch("/api/suggest-production-order",{
        method:"POST",
        headers: await authJsonHeaders(),
        body:JSON.stringify({items:payloadItems,client,instructions:productionOrderInstructions,productionMode:"Producción nueva"})
      });
      const data = await response.json();
      if(!response.ok)throw new Error(data?.error || "No se pudo generar el orden con IA.");
      applySuggestedProductionOrder(data.items || [],"ai");
      alert(data.mode === "fallback" ? "Se generó un orden operativo automático. Revisa y ajusta manualmente si hace falta." : "La IA propuso un orden de producción. Puedes ajustarlo antes de crear la producción.");
    }catch(error:any){
      alert(error?.message || "No se pudo ordenar con IA.");
    }finally{
      setOrderingWithAi(false);
    }
  }

  function buildProductionOrderPayload(){
    const ids = form.requestIds || [];
    const order:Record<string,number> = {};
    const reasons:Record<string,string> = {};
    const groups:Record<string,string> = {};
    const moments:Record<string,string> = {};
    const priorities:Record<string,string> = {};
    const immediate:Record<string,boolean> = {};
    const lotSequenceNumbers:Record<string,number> = {};
    ids.forEach((id,index)=>{
      const suggestion = productionOrderReasons[id];
      const request = requestById.get(id);
      const sequence = Number(request?.lotSequenceNumber ?? request?.number ?? index + 1);
      order[id] = index + 1;
      if(Number.isFinite(sequence))lotSequenceNumbers[id] = sequence;
      if(suggestion?.reason)reasons[id] = suggestion.reason;
      if(suggestion?.group)groups[id] = suggestion.group;
      if(suggestion?.moment)moments[id] = suggestion.moment;
      if(suggestion?.priority)priorities[id] = suggestion.priority;
      immediate[id] = Boolean(suggestion?.requiresImmediateCapture);
    });
    return {order,reasons,groups,moments,priorities,immediate,lotSequenceNumbers};
  }

  async function submit(){
    if(!canCreateProduction)return permissionAlert("crear producciones");
    if(!form.title||!form.scheduledDate||!form.materialDueDate||!form.startTime||!form.endTime||!(form.locations||form.location)||!form.producer||!(form.teamMembers||[]).length||!form.objective||!form.requirements||!form.shotList)return alert("Todos los campos de la producción son obligatorios, incluida la fecha límite para completar materiales.");
    if(isWeekendDate(form.scheduledDate) || isWeekendDate(form.materialDueDate))return alert("La producción y la entrega de materiales deben programarse en días hábiles, no sábado ni domingo.");
    const orderPayload = buildProductionOrderPayload();
    const productionData:Production = {
      ...form,
      productionOrder: orderPayload.order,
      productionOrderReasons: orderPayload.reasons,
      productionOrderGroups: orderPayload.groups,
      productionOrderMoments: orderPayload.moments,
      productionOrderPriorities: orderPayload.priorities,
      productionOrderImmediate: orderPayload.immediate,
      productionLotSequenceNumbers: orderPayload.lotSequenceNumbers,
      productionOrderMode,
      productionOrderInstructions,
      productionOrderGeneratedAt: new Date().toISOString()
    };
    const ref = await saveProduction(productionData);
    await Promise.all(form.requestIds.map((id,index)=>updateRequest(id,{
      productionId:ref.id,
      productionName:form.title,
      lotSequenceNumber:orderPayload.lotSequenceNumbers[id] || requestById.get(id)?.number || index+1,
      productionOrder:index+1,
      productionOrderReason:orderPayload.reasons[id] || "",
      productionOrderGroup:orderPayload.groups[id] || "",
      productionOrderMoment:orderPayload.moments[id] || "",
      productionPriority:orderPayload.priorities[id] || "normal",
      requiresImmediateCapture:orderPayload.immediate[id] || false,
      aiSuggestedOrder:productionOrderMode === "ai",
      manualOrderEdited:productionOrderMode === "manual",
      status:"produccion_programada"
    })));
    setSelected([]);
    setShowModal(false);
    setProductionOrderReasons({});
    setProductionOrderInstructions("");
    setProductionOrderMode("manual");
    setForm(empty);
    await load();
    alert("Producción creada");
  }

  function setEditingField(k:keyof Production,v:any){
    if(!canEditProduction)return;
    if(editing)setEditing({...editing,[k]:v});
  }

  function setPostMaterialLink(requestId:string, value:string){
    if(!canEditProduction)return;
    if(!editing)return;
    setEditing({
      ...editing,
      materialLinksByRequest:{
        ...(editing.materialLinksByRequest||{}),
        [requestId]: value
      }
    });
  }

  async function uploadProductionMaterial(files:FileList|null){
    if(!canEditProduction)return permissionAlert("subir material de producción");
    if(!editing||!files)return;
    setUploading(true);
    try{
      const uploaded=await uploadReferenceFiles(files,"production-material");
      setEditing({...editing,materialFiles:[...(editing.materialFiles||[]),...uploaded]});
    }finally{
      setUploading(false);
    }
  }

  function removeProductionFile(index:number){
    if(!canEditProduction)return permissionAlert("eliminar material de producción");
    if(!editing)return;
    setEditing({...editing,materialFiles:(editing.materialFiles||[]).filter((_,i)=>i!==index)});
  }

  async function persistEditingMaterial(){
    if(!canEditProduction)return permissionAlert("guardar material de producción");
    if(!editing?.id)return;
    await updateProduction(editing.id,{...editing});
  }

  async function saveProductionMaterial(markDelivered=false){
    if(!canEditProduction)return permissionAlert("marcar material de producción");
    if(!editing?.id)return;
    if(!markDelivered){
      await persistEditingMaterial();
      await load();
      return;
    }
    if(!(editing.materialLinks||"").trim())return alert("Agrega el link general de material de la producción.");
    const missingLinks = (editing.requestIds||[]).filter(id => !((editing.materialLinksByRequest||{})[id] || "").trim());
    if(missingLinks.length){
      alert("Falta link específico de material en una o más publicaciones.");
      return;
    }
    const nextStatus = "material_entregado";
    const deliveredAt = new Date().toISOString();
    await updateProduction(editing.id,{...editing,status:nextStatus,materialDeliveredAt:deliveredAt});
    await Promise.all((editing.requestIds||[]).map(id=>{
      const req = requests.find(x=>x.id===id);
      const individualLink = ((editing.materialLinksByRequest||{})[id] || "").trim();
      const generalLinks = (editing.materialLinks || "").trim();
      const mergedLinks = mergeLinks([individualLink, generalLinks, req?.materialLinks || ""]);
      const mergedFiles = mergeFiles([...(req?.materialFiles || []), ...(editing.materialFiles || [])]);
      const comments = [...(req?.comments||[]), {
        id:`${Date.now()}-${id}`,
        author:"Sistema",
        target:"Asignación",
        body:`Material de producción entregado. Link específico: ${individualLink || "Sin link específico"}. Link general: ${generalLinks || "Sin link general"}. Esta solicitud ya puede asignarse.`,
        mentions:["@asignacion"],
        status:"open" as const,
        createdAt:deliveredAt
      }];
      return updateRequest(id,{
        materialAvailable:true,
        materialLinks:mergedLinks,
        materialFiles:mergedFiles,
        productionSpecificMaterialLink:individualLink,
        productionGeneralMaterialLinks:generalLinks,
        productionMaterialFiles:editing.materialFiles || [],
        materialDeliveredAt:deliveredAt,
        status:"material_listo",
        comments
      });
    }));
    setEditing(null);
    await load();
    alert("Material entregado y solicitudes desbloqueadas");
  }

  return <AppShell active="Producciones">
    <section className="hero"><div><p className="eyebrow">Producciones</p><h1>Producciones</h1><p>Selecciona solicitudes pendientes y crea una producción con esas fichas.</p></div><button className="btn" onClick={openModal} disabled={!canCreateProduction}>Producción nueva</button></section>

    {!canCreateProduction && <section className="card readonly-note">Modo solo lectura: puedes consultar producciones, pero tu rol no puede crear ni modificar material.</section>}

    <section className="grid kpis">
      {[["Pendientes",String(productionRequests.length)],["Seleccionadas",String(selected.length)],["Producciones",String(filteredProductions.length)],["Programadas",String(filteredProductions.filter(x=>x.status==="programada").length)],["Material",String(filteredProductions.filter(x=>x.status==="material_entregado").length)],["Clientes",String(brands.length)]].map(([a,b])=><div className="kpi" key={a}><span>{a}</span><strong>{b}</strong></div>)}
    </section>

    <section className="filter-panel">
      <h3>Filtros de solicitudes pendientes de producción</h3>
      <div className="filter-grid">
        <div className="field"><label>Cliente</label><select value={reqClientFilter} onChange={e=>setReqClientFilter(e.target.value)}><option value="all">Todos</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="field"><label>Lote</label><select value={reqBatchFilter} onChange={e=>setReqBatchFilter(e.target.value)}><option value="all">Todos</option>{requestBatchOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="field"><label>Desde entrega interna</label><input type="date" value={reqStartDate} onChange={e=>setReqStartDate(e.target.value)}/></div>
        <div className="field"><label>Hasta entrega interna</label><input type="date" value={reqEndDate} onChange={e=>setReqEndDate(e.target.value)}/></div>
        <div className="filter-actions">
          <button className="btn" onClick={()=>{setReqClientFilter("all");setReqBatchFilter("all");setReqStartDate("");setReqEndDate("");}}>Limpiar</button>
        </div>
      </div>
    </section>

    <section className="grid two-col">
      <div className="card">
        <h3>Solicitudes pendientes de producción</h3>
        <div className="assignment-lot-groups">
          <div className="assignment-lot-tools">
            <label className="mini" style={{display:"flex",alignItems:"center",gap:8}}>
              <input
                type="checkbox"
                checked={allVisibleProductionSelected}
                disabled={!canCreateProduction || !visibleProductionRequestIds.length}
                onChange={event=>toggleAllVisibleProductionRequests(event.target.checked)}
              />
              Seleccionar visibles
            </label>
            <button className="btn" type="button" onClick={()=>setCollapsedProductionBatchIds([])}>Abrir lotes</button>
            <button className="btn" type="button" onClick={()=>setCollapsedProductionBatchIds(groupedProductionRequests.map(group=>group.id))}>Cerrar lotes</button>
            <SortButton label="Lote" active={requestSort.key==="batch"} direction={requestSort.direction} onClick={()=>toggleRequestSort("batch")}/>
            <SortButton label="Entrega" active={requestSort.key==="dueDate"} direction={requestSort.direction} onClick={()=>toggleRequestSort("dueDate")}/>
            <SortButton label="Solicitud" active={requestSort.key==="request"} direction={requestSort.direction} onClick={()=>toggleRequestSort("request")}/>
            <SortButton label="Fecha publicación" active={requestSort.key==="publishDate"} direction={requestSort.direction} onClick={()=>toggleRequestSort("publishDate")}/>
            <span className="mini">Ordenado por lote · {groupedProductionRequests.length} bloque(s)</span>
          </div>
          {groupedProductionRequests.map(group=>{
            const collapsed = collapsedProductionBatchIds.includes(group.id);
            const groupIds = group.items.map(item=>item.id).filter(Boolean) as string[];
            const allSelected = groupIds.length > 0 && groupIds.every(id=>selected.includes(id));
            const videoCount = group.items.filter(isVideoRequest).length;
            const staticCount = group.items.length - videoCount;
            const selectedCount = group.items.filter(item=>item.id && selected.includes(item.id)).length;
            return <div className="assignment-lot-block" key={group.id}>
              <div className="assignment-lot-header">
                <div className="assignment-lot-main">
                  <input
                    type="checkbox"
                    title="Seleccionar solicitudes de este lote"
                    disabled={!canCreateProduction || !groupIds.length}
                    checked={allSelected}
                    onChange={event=>toggleProductionBatchSelection(group.items,event.target.checked)}
                  />
                  <button type="button" className="assignment-lot-toggle" onClick={()=>toggleProductionBatchCollapse(group.id)}>
                    <span>{collapsed ? "▸" : "▾"}</span>
                    <strong>{group.name}</strong>
                  </button>
                  <span className="mini">{group.clientName}</span>
                </div>
                <div className="assignment-lot-summary">
                  <span className="pill">{group.items.length} solicitudes</span>
                  <span className="pill orange">{videoCount} video</span>
                  <span className="pill blue">{staticCount} estático/foto</span>
                  {selectedCount > 0 && <span className="pill green">{selectedCount} seleccionadas</span>}
                </div>
              </div>
              {!collapsed && <div className="assignment-lot-items">
                {group.items.map(item=><div key={item.id} className="assignment-request-card">
                  <div className="assignment-request-select">
                    <input type="checkbox" checked={selected.includes(item.id!)} disabled={!canCreateProduction} onChange={()=>toggle(item.id!)}/>
                    <span className="mini">{lotSequenceLabel(item)} de {item.total || "--"}</span>
                  </div>
                  <div className="assignment-request-info">
                    <strong>{item.clientName}</strong>
                    <span>{item.contentType} · {item.objective}</span>
                    <span className="mini text-clamp-2">{item.creativeIdea}</span>
                    <span className="mini text-clamp-2">Notas: {item.productionNotes || "Sin notas de producción"}</span>
                  </div>
                  <div className="assignment-request-date">
                    <strong>{getProductionDueDate(item) || "Sin fecha"}</strong>
                    <span className="mini">Máx. producción</span>
                    <span className="mini">Entrega interna: {getInternalDueDate(item)||"Sin fecha"}</span>
                    <span className="mini">Publica: {item.publishDate||"Sin fecha"}</span>
                  </div>
                  <div className="assignment-request-status">
                    <span className={isVideoRequest(item)?"pill orange":"pill blue"}>{requestTypeLabel(item)}</span>
                    <span className="pill">Pendiente producción</span>
                  </div>
                  <div className="assignment-request-actions">
                    <button className="btn" type="button" onClick={()=>setPendingDetail(item)}>Detalle</button>
                  </div>
                </div>)}
              </div>}
            </div>
          })}
          {!groupedProductionRequests.length && <div className="empty-state">No hay solicitudes pendientes con esos filtros.</div>}
        </div>
      </div>
      <aside className="card">
        <h3>Seleccionadas</h3>
        {selectedRequests.map(x=><div className="draft-item" key={x.id}><strong>{lotSequenceLabel(x)} · {requestTypeLabel(x)} · {x.contentType}</strong><span className="mini text-clamp-2">{x.creativeIdea}</span></div>)}
        {!selectedRequests.length && <p className="mini">Selecciona solicitudes para crear una producción.</p>}
      </aside>
    </section>

    <section className="filter-panel">
      <h3>Filtros del calendario de producciones</h3>
      <div className="filter-grid">
        <div className="field"><label>Cliente</label><select value={prodClientFilter} onChange={e=>setProdClientFilter(e.target.value)}><option value="all">Todos</option>{brands.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="field"><label>Lote</label><select value={prodBatchFilter} onChange={e=>setProdBatchFilter(e.target.value)}><option value="all">Todos</option>{productionBatchOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <div className="field"><label>Estado</label><select value={prodStatusFilter} onChange={e=>setProdStatusFilter(e.target.value)}><option value="all">Todos</option><option value="programada">Programada</option><option value="material_entregado">Material entregado</option><option value="cancelada">Cancelada</option></select></div>
        <div className="field"><label>Responsable</label><select value={prodProducerFilter} onChange={e=>setProdProducerFilter(e.target.value)}><option value="all">Todos</option>{producerOptions.map(x=><option key={x}>{x}</option>)}</select></div>
        <div className="field"><label>Material</label><select value={prodMaterialFilter} onChange={e=>setProdMaterialFilter(e.target.value)}><option value="all">Todo</option><option value="with">Con material</option><option value="without">Sin material</option></select></div>
        <div className="field"><label>Desde producción</label><input type="date" value={prodStartDate} onChange={e=>setProdStartDate(e.target.value)}/></div>
        <div className="field"><label>Hasta producción</label><input type="date" value={prodEndDate} onChange={e=>setProdEndDate(e.target.value)}/></div>
        <div className="field" style={{gridColumn:"span 2"}}><label>Buscar</label><input value={prodSearch} onChange={e=>setProdSearch(e.target.value)} placeholder="Producción, cliente, locación, responsable..."/></div>
        <div className="filter-actions">
          <button className="btn" onClick={()=>{setProdClientFilter("all");setProdBatchFilter("all");setProdStatusFilter("all");setProdProducerFilter("all");setProdMaterialFilter("all");setProdStartDate("");setProdEndDate("");setProdSearch("");}}>Limpiar</button>
        </div>
      </div>
    </section>

    <section className="card" style={{marginTop:24}}>
      <h3>Calendario de producciones</h3>
      <table className="table"><thead><tr><th><SortButton label="Producción" active={productionSort.key==="title"} direction={productionSort.direction} onClick={()=>toggleProductionSort("title")}/></th><th><SortButton label="Cliente" active={productionSort.key==="client"} direction={productionSort.direction} onClick={()=>toggleProductionSort("client")}/></th><th><SortButton label="Fecha" active={productionSort.key==="scheduledDate"} direction={productionSort.direction} onClick={()=>toggleProductionSort("scheduledDate")}/></th><th><SortButton label="Vence material" active={productionSort.key==="materialDueDate"} direction={productionSort.direction} onClick={()=>toggleProductionSort("materialDueDate")}/></th><th><SortButton label="Responsable" active={productionSort.key==="producer"} direction={productionSort.direction} onClick={()=>toggleProductionSort("producer")}/></th><th>Material</th><th><SortButton label="Solicitudes" active={productionSort.key==="requests"} direction={productionSort.direction} onClick={()=>toggleProductionSort("requests")}/></th><th><SortButton label="Estado" active={productionSort.key==="status"} direction={productionSort.direction} onClick={()=>toggleProductionSort("status")}/></th><th>Brief</th></tr></thead><tbody>{filteredProductions.map(p=>{
        const hasMaterial = Boolean((p.materialLinks||"").trim()) || Boolean((p.materialFiles||[]).length) || Boolean(Object.values(p.materialLinksByRequest||{}).some(v=>String(v||"").trim()));
        const dueStatus = materialDueStatus(p);
        return <tr key={p.id}><td><strong>{p.title}</strong><br/><span className="mini">{(p.locations||p.location)||"Sin locaciones"}</span></td><td>{p.clientName}</td><td>{p.scheduledDate}</td><td>{p.materialDueDate || "Sin fecha"}<br/><span className={`pill ${dueStatus.tone}`}>{dueStatus.label}</span></td><td>{p.producer||"Sin responsable"}</td><td>{hasMaterial?<span className="pill green">Con material</span>:<span className="pill orange">Sin material</span>}</td><td>{p.requestIds.length}</td><td>{p.status}</td><td><button className="btn" onClick={()=>setEditing(p)}>Completar links</button> <button className="btn" onClick={()=>setBrief(p)}>Exportar brief</button></td></tr>
      })}</tbody></table>
      {!filteredProductions.length && <p className="mini">No hay producciones con esos filtros.</p>}
    </section>

    {brief && <div className="modal-backdrop"><div className="modal-card" style={{width:"min(1200px,96vw)"}}>
      <div className="brief-actions">
        <button className="btn blue" onClick={()=>window.print()}>Imprimir / Guardar PDF tamaño hoja</button>
        <button className="btn red" onClick={()=>setBrief(null)}>Cerrar</button>
      </div>
      <ProductionBrief production={brief} requests={requests}/>
    </div></div>}

    {editing && <section className="card production-material-inline" style={{marginTop:24}}>
      <h2>Completar material de producción</h2>
      <p className="mini">{editing.title} · {editing.clientName} · Límite material: {editing.materialDueDate || "Sin fecha"}</p>
      <div className="production-material-box">
        <div className="field">
          <label>Link general del material producido *</label>
          <input value={editing.materialLinks||""} onChange={e=>setEditingField("materialLinks",e.target.value)} onBlur={persistEditingMaterial} placeholder="Carpeta general de Drive, Dropbox, Frame, WeTransfer, etc."/>
          <div className="material-mode-note">Se guarda al salir del campo. Además, cada publicación debe tener su link específico.</div>
        </div>
        <div className="field full">
          <label>Archivos generales de producción</label>
          <input type="file" multiple disabled={!canEditProduction || uploading} onChange={e=>uploadProductionMaterial(e.target.files)}/>
          <div className="material-mode-note">Estos archivos se heredarán a todas las solicitudes cuando marques el material como entregado.</div>
          {uploading && <p className="mini">Subiendo archivos...</p>}
          <ReadOnlyFileGrid files={editing.materialFiles || []} onPreview={setPreview} emptyText="Sin archivos generales todavía."/>
          {(editing.materialFiles || []).length>0 && canEditProduction && <div className="material-file-actions">{(editing.materialFiles || []).map((file,index)=><button type="button" className="btn mini-btn" key={`${file.url}-${index}`} onClick={()=>removeProductionFile(index)}>Quitar {file.name || `archivo ${index+1}`}</button>)}</div>}
        </div>
      </div>

      <h3>Links por solicitud / post</h3>
      <div className="table-wrap"><table className="table material-links-table"><thead><tr><th>Publicación</th><th>Idea</th><th>Fecha</th><th>Link específico *</th><th>Acciones</th></tr></thead><tbody>
        {(editing.requestIds||[]).map(id=>{
          const req=requests.find(x=>x.id===id);
          const link=(editing.materialLinksByRequest||{})[id]||"";
          return <tr key={id}>
            <td><strong>{req?.contentType||"Solicitud"} · {req?.objective||""}</strong></td>
            <td><span className="mini text-clamp-2">{req?.creativeIdea||id}</span></td>
            <td>{req?.publishDate||"Sin fecha"}</td>
            <td><input value={link} onChange={e=>setPostMaterialLink(id,e.target.value)} onBlur={persistEditingMaterial} placeholder="Link exacto del material para esta pieza"/></td>
            <td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{req && <button type="button" className="btn" onClick={()=>setPendingDetail(req)}>Ver solicitud</button>}{link ? <a className="btn" href={link} target="_blank">Abrir link</a> : <span className="mini">Sin link</span>}</div></td>
          </tr>
        })}
      </tbody></table></div>

      <div style={{display:"flex",gap:12,marginTop:16,flexWrap:"wrap"}}>
        <button className="btn blue" onClick={()=>saveProductionMaterial(true)} disabled={!canEditProduction}>Marcar como material entregado</button>
        <button className="btn red" onClick={()=>setEditing(null)}>Cerrar</button>
      </div>
    </section>}

    {pendingDetail && <div className="modal-backdrop"><div className="modal-card" style={{width:"min(980px,96vw)",maxHeight:"92vh",overflow:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
        <div>
          <p className="eyebrow">Solicitud completa de producción</p>
          <h2>{pendingDetail.clientName}</h2>
          <p className="mini">{pendingDetail.batchName||"Sin lote"}</p>
        </div>
        <button className="btn red" onClick={()=>setPendingDetail(null)}>Cerrar</button>
      </div>
      <ProductionRequestDetail item={pendingDetail} onPreview={setPreview} typeLabel={requestTypeLabel(pendingDetail)} internalDueDate={getInternalDueDate(pendingDetail)}/>
    </div></div>}

    {preview && <PreviewModal file={preview} onClose={()=>setPreview(null)}/>}

    {showModal && <div className="modal-backdrop"><div className="modal-card">
      <h2>Producción nueva</h2>
      <div className="form-grid">
        <div className="field full"><label>Título *</label><input value={form.title} onChange={e=>set("title",e.target.value)}/></div>
        <div className="field"><label>Cliente</label><input value={form.clientName} disabled/></div>
        <div className="field"><label>Fecha producción *</label><input type="date" value={form.scheduledDate} onChange={e=>safeProductionDate("scheduledDate",e.target.value)}/></div>
        <div className="field"><label>Fecha límite de materiales *</label><input type="date" value={form.materialDueDate||""} onChange={e=>safeProductionDate("materialDueDate",e.target.value)}/><span className="mini">Día máximo para completar links de material.</span></div>
        <div className="field"><label>Hora de inicio *</label><input type="time" step="1800" value={form.startTime} onChange={e=>set("startTime",e.target.value)}/></div>
        <div className="field"><label>Duración *</label><select value={String(form.durationMinutes||120)} onChange={e=>set("durationMinutes" as keyof Production, Number(e.target.value))}>{[30,60,90,120,150,180,210,240,300,360,420,480].map(minutes=><option key={minutes} value={minutes}>{durationLabel(minutes)}</option>)}</select></div>
        <div className="field"><label>Hora de finalización</label><input value={form.endTime||""} disabled placeholder="Se calcula sola"/></div>
        <div className="field full"><label>Objetivo general *</label><textarea value={form.objective} onChange={e=>set("objective",e.target.value)} placeholder="Escribe manualmente el objetivo de la producción."/></div>
        <div className="field full"><label>Locaciones *</label><textarea value={form.locations||form.location||""} onChange={e=>{set("locations",e.target.value);set("location",e.target.value)}} placeholder="Puedes agregar una o varias locaciones, una por línea."/></div>
        <div className="field"><label>Responsable de producción *</label><select value={form.producer} onChange={e=>set("producer",e.target.value)}><option value="">Seleccionar responsable</option>{teamOptions.map(name=><option key={name}>{name}</option>)}</select></div>
        <div className="field full"><label>Equipo que asiste *</label><div className="client-chip-grid">{teamOptions.map(name=><button type="button" className={(form.teamMembers||[]).includes(name)?"chip-btn selected":"chip-btn"} key={name} onClick={()=>toggleTeamMember(name)}>{name}</button>)}</div></div>
        <div className="field full"><label>Observaciones *</label><textarea value={form.shotList} onChange={e=>set("shotList",e.target.value)} placeholder="Observaciones generales, tomas especiales, logística o detalles relevantes. No se llena automáticamente."/></div>
        <div className="field full"><label>Requerimientos *</label><textarea value={form.requirements} onChange={e=>set("requirements",e.target.value)} placeholder="Equipo, props, permisos, modelos, productos, horarios, vestuario, etc."/></div>
      </div>
      <div className="production-order-panel">
        <div className="production-order-head">
          <div>
            <h3>Orden de producción</h3>
            <p className="mini">Acomoda el orden de producción sin cambiar el número interno del post dentro del lote. El equipo puede seguir hablando de “Post #10” aunque sea el primero en grabarse.</p>
          </div>
          <span className={productionOrderMode === "ai" ? "pill green" : "pill blue"}>{productionOrderMode === "ai" ? "Orden sugerido por IA" : "Orden manual"}</span>
        </div>
        <div className="field full">
          <label>Instrucciones para ordenar esta producción</label>
          <textarea
            value={productionOrderInstructions}
            onChange={e=>setProductionOrderInstructions(e.target.value)}
            placeholder="Ejemplo: primero bebidas y ambiente; platillos calientes se graban en video al salir de cocina y después foto hero. Agrupar por sucursal o por cocina."
          />
        </div>
        <div className="production-order-actions">
          <button className="btn blue" type="button" onClick={orderSelectionWithAi} disabled={!canCreateProduction || orderingWithAi}>{orderingWithAi ? "Revisando con IA..." : "Revisar y ordenar con IA"}</button>
          <button className="btn" type="button" onClick={()=>quickSortProductionOrder("photo-first")}>Fotos primero</button>
          <button className="btn" type="button" onClick={()=>quickSortProductionOrder("video-first")}>Videos primero</button>
          <button className="btn" type="button" onClick={()=>quickSortProductionOrder("keep-batch")}>Orden del lote</button>
          <button className="btn" type="button" onClick={()=>{setProductionOrderMode("manual");setProductionOrderReasons({});}}>Limpiar sugerencia IA</button>
          <span className="mini">Arrastra las tarjetas para acomodarlas. Los botones rápidos solo reordenan la selección visible en esta producción.</span>
        </div>
        <div className="production-order-list">
          {modalOrderedRequests.map((x,index)=>{
            const suggestion = x.id ? productionOrderReasons[x.id] : null;
            return <div
              className={`production-order-item ${dragProductionRequestId === x.id ? "dragging" : ""}`}
              key={x.id}
              draggable={canCreateProduction}
              onDragStart={event=>{setDragProductionRequestId(x.id || null); event.dataTransfer.effectAllowed="move"; if(x.id)event.dataTransfer.setData("text/plain",x.id);}}
              onDragOver={event=>{event.preventDefault(); event.dataTransfer.dropEffect="move";}}
              onDrop={event=>{event.preventDefault(); const sourceId = event.dataTransfer.getData("text/plain") || dragProductionRequestId || ""; if(x.id)moveProductionRequestByDrag(sourceId,x.id); setDragProductionRequestId(null);}}
              onDragEnd={()=>setDragProductionRequestId(null)}
            >
              <div className="production-order-number"><span className="drag-handle">☰</span><strong>{lotSequenceLabel(x,index)}</strong><span className="mini">{productionOrderLabel(index)}</span></div>
              <div className="production-order-body">
                <div className="production-order-title">
                  <strong>{x.contentType} · {x.objective}</strong>
                  <span className="pill">Núm. lote fijo: {lotSequenceLabel(x,index)}</span>
                  <span className={isVideoRequest(x)?"pill orange":"pill blue"}>{requestTypeLabel(x)}</span>
                  {suggestion?.requiresImmediateCapture && <span className="pill red">Captura inmediata</span>}
                </div>
                <span className="mini text-clamp-2">{x.creativeIdea}</span>
                <span className="mini text-clamp-2">Notas: {x.productionNotes || "Sin notas"}</span>
                {suggestion && <div className="production-order-ai-note">
                  <strong>{suggestion.group}</strong> · {suggestion.moment}
                  <br/>
                  {suggestion.reason}
                </div>}
              </div>
              <div className="production-order-controls">
                <button className="btn mini-btn red" type="button" onClick={()=>removeFromProductionOrder(x.id!)}>Quitar</button>
              </div>
            </div>
          })}
          {!modalOrderedRequests.length && <p className="mini">No hay solicitudes incluidas.</p>}
        </div>
      </div>
      <div style={{display:"flex",gap:12,marginTop:16}}><button className="btn blue" onClick={submit} disabled={!canCreateProduction}>Crear producción</button><button className="btn red" onClick={()=>setShowModal(false)}>Cerrar</button></div>
    </div></div>}
  </AppShell>
}




function SortButton({label,active,direction,onClick}:{label:string;active:boolean;direction:"asc"|"desc";onClick:()=>void}){
  return <button type="button" className={active?"sort-button active":"sort-button"} onClick={onClick}>{label} {active ? (direction==="asc"?"↑":"↓") : "↕"}</button>;
}


function getLotSequenceNumberLabel(item?:ContentRequest|null, fallbackIndex?:number){
  const raw = item?.lotSequenceNumber ?? item?.number ?? (typeof fallbackIndex === "number" ? fallbackIndex + 1 : undefined);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : "--";
}

function lotSequenceLabel(item?:ContentRequest|null, fallbackIndex?:number){
  return `Post #${getLotSequenceNumberLabel(item,fallbackIndex)}`;
}

function isProductionVideoRequest(item:ContentRequest){
  const text = `${item.contentType} ${item.visualFormat || ""} ${item.feedPlacement || ""}`.toLowerCase();
  return /reel|video|tik|vertical|story/.test(text);
}

function splitLinks(value:string){
  return (value||"")
    .split(/\s|,|\n/)
    .map(x=>x.trim())
    .filter(x=>x.startsWith("http://")||x.startsWith("https://"));
}

function mergeLinks(values:string[]){
  const seen = new Set<string>();
  const links:string[] = [];
  values.forEach(value=>{
    splitLinks(value || "").forEach(link=>{
      if(!seen.has(link)){
        seen.add(link);
        links.push(link);
      }
    });
  });
  return links.join("\n");
}

function mergeFiles(files:ReferenceFile[]){
  const seen = new Set<string>();
  const result:ReferenceFile[] = [];
  files.forEach(file=>{
    const key = file.url || file.name || JSON.stringify(file);
    if(!seen.has(key)){
      seen.add(key);
      result.push(file);
    }
  });
  return result;
}

function LinkList({links,emptyText="Sin links."}:{links:string[];emptyText?:string}){
  if(!links.length)return <p className="mini">{emptyText}</p>;
  return <div className="brief-link-list">{links.map((link,index)=><a className="brief-link" href={link} target="_blank" key={`${link}-${index}`}>{link}</a>)}</div>;
}

function ReadOnlyFileGrid({files,onPreview,emptyText="Sin archivos."}:{files:ReferenceFile[];onPreview:(file:ReferenceFile)=>void;emptyText?:string}){
  if(!(files||[]).length)return <p className="mini">{emptyText}</p>;
  return <div className="ref-grid">
    {(files||[]).map((file,index)=><button type="button" className="ref-thumb" onClick={()=>onPreview(file)} key={`${file.url || file.name}-${index}`}>
      {isImageFile(file)?<img src={file.url} alt={file.name || "Referencia"}/>:isVideoFile(file)?<video src={file.url} muted playsInline preload="metadata"/>:<div className="ref-thumb-file">{file.name || "Archivo"}</div>}
    </button>)}
  </div>;
}

function ProductionRequestDetail({item,onPreview,typeLabel,internalDueDate}:{item:ContentRequest;onPreview:(file:ReferenceFile)=>void;typeLabel:string;internalDueDate:string}){
  const referenceLinks = splitLinks(item.referenceLinks || "");
  const materialLinks = splitLinks(item.materialLinks || "");
  const specificMaterialLinks = splitLinks(item.productionSpecificMaterialLink || "");
  const generalMaterialLinks = splitLinks(item.productionGeneralMaterialLinks || "");
  const productionMaterialFiles = item.productionMaterialFiles || [];
  const materialFiles = item.materialFiles || [];
  const visibleMaterialFiles = mergeFiles([...materialFiles, ...productionMaterialFiles]);

  return <div className="production-request-detail">
    <div className="detail-copy"><strong>Lote:</strong> {item.batchName||"Sin lote"}{"\n"}<strong>Entrega interna:</strong> {internalDueDate||"Sin fecha"}{"\n"}<strong>Publicación:</strong> {item.publishDate||"Sin fecha"}{"\n"}<strong>Tipo:</strong> {typeLabel}{"\n"}<strong>Producción:</strong> {item.productionName||"Sin producción asignada"}{"\n"}<strong>Material entregado:</strong> {item.materialDeliveredAt ? new Date(item.materialDeliveredAt).toLocaleString("es-MX") : "Pendiente"}</div>

    <div className="detail-section"><h4>Solicitud inicial</h4><div className="detail-copy"><strong>{item.contentType} · {item.objective}</strong>{"\n"}{item.creativeIdea || "Sin idea creativa"}</div></div>

    <div className="detail-section"><h4>Copy / Mensaje / CTA</h4><div className="detail-copy"><strong>Copy In:</strong> {item.copyIn||"Sin copy"}{"\n"}<strong>Mensaje:</strong> {item.keyMessage||"Sin mensaje"}{"\n"}<strong>CTA:</strong> {item.cta||"Sin CTA"}</div></div>

    <div className="detail-section"><h4>Notas para producción</h4><div className="detail-copy">{item.productionNotes||"Sin notas de producción"}</div></div>

    <div className="detail-section"><h4>Referencias visuales de la solicitud</h4><ReadOnlyFileGrid files={item.referenceFiles || []} onPreview={onPreview} emptyText="Sin imágenes o archivos de referencia."/><LinkList links={referenceLinks} emptyText="Sin links de referencia."/></div>

    <div className="detail-section"><h4>Material entregado por producción</h4><div className="detail-copy"><strong>Link específico:</strong> {specificMaterialLinks[0] || "Pendiente"}{"\n"}<strong>Link general:</strong> {generalMaterialLinks[0] || "Pendiente"}</div><ReadOnlyFileGrid files={visibleMaterialFiles} onPreview={onPreview} emptyText="Sin archivos de material entregado."/><LinkList links={materialLinks} emptyText="Sin links de material todavía."/></div>
  </div>;
}

function ProductionBrief({production,requests}:{production:Production;requests:ContentRequest[]}){
  const included = ((production.requestIds||[])
    .map(id=>requests.find(x=>x.id===id))
    .filter(Boolean) as ContentRequest[]).sort((a,b)=>{
      const orderA = production.productionOrder?.[a.id||""] || a.productionOrder || 9999;
      const orderB = production.productionOrder?.[b.id||""] || b.productionOrder || 9999;
      if(orderA !== orderB)return orderA - orderB;
      return Number(!isProductionVideoRequest(a))-Number(!isProductionVideoRequest(b));
    });

  const generalLinks = splitLinks(production.materialLinks||"");

  return <section className="production-brief">
    <div className="brief-cover">
      <p className="eyebrow">Brief visual de producción</p>
      <h1>{production.title}</h1>
      <p>{production.clientName}</p>
    </div>

    <div className="brief-meta-grid">
      <div className="brief-meta"><span>Fecha</span><strong>{production.scheduledDate||"Sin fecha"}</strong></div>
      <div className="brief-meta"><span>Límite material</span><strong>{production.materialDueDate||"Sin fecha"}</strong></div>
      <div className="brief-meta"><span>Horario</span><strong>{production.startTime||"--"} - {production.endTime||"--"}</strong></div>
      <div className="brief-meta"><span>Locaciones</span><strong>{(production.locations||production.location)||"Sin locaciones"}</strong></div>
      <div className="brief-meta"><span>Responsable</span><strong>{production.producer||"Sin responsable"}</strong></div>
    </div>

    <div className="brief-columns">
      <div className="brief-box">
        <h4>Objetivo general</h4>
        {production.objective||"Sin objetivo general"}
      </div>
      <div className="brief-box">
        <h4>Equipo / Requerimientos</h4>
        <strong>Equipo:</strong> {production.team||"Sin equipo"}{"\n"}
        <strong>Requerimientos:</strong> {production.requirements||"Sin requerimientos"}
      </div>
    </div>

    <div className="brief-box">
      <h4>Observaciones</h4>
      {production.shotList||"Sin observaciones"}
    </div>

    <div className="brief-box">
      <h4>Material general</h4>
      {generalLinks.length>0 && <div style={{marginTop:10}}>
        <strong>Link general de material:</strong>
        {generalLinks.map((link,index)=><a className="brief-link" href={link} target="_blank" key={index}>{link}</a>)}
      </div>}
    </div>

    <div>
      <h2 style={{margin:"4px 0 14px"}}>Solicitudes / tomas por pieza</h2>
      <div style={{display:"grid",gap:16}}>
        {included.map((item,index)=>{
          const referenceLinks = splitLinks(item.referenceLinks);
          const materialLink = (production.materialLinksByRequest||{})[item.id||""] || item.materialLinks || production.materialLinks || "";
          const materialLinks = splitLinks(materialLink);
          const refs = item.referenceFiles || [];
          const orderNumber = production.productionOrder?.[item.id||""] || item.productionOrder || index+1;
          const orderReason = production.productionOrderReasons?.[item.id||""] || item.productionOrderReason || "";
          const orderGroup = production.productionOrderGroups?.[item.id||""] || item.productionOrderGroup || "";
          const orderMoment = production.productionOrderMoments?.[item.id||""] || item.productionOrderMoment || "";
          const immediate = Boolean(production.productionOrderImmediate?.[item.id||""] || item.requiresImmediateCapture);
          return <article className="brief-request-card" key={item.id||index}>
            <div className="brief-request-head">
              <div>
                <p className="eyebrow">{lotSequenceLabel(item,index)} · Orden de producción #{orderNumber}</p>
                <h3 className="brief-request-title">{item.contentType} · {item.objective}</h3>
                <p className="mini">Número interno fijo del lote: {lotSequenceLabel(item,index)} · Publica: {item.publishDate||"Sin fecha"} · Área: {item.suggestedArea||"Sin área"}</p>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
                {immediate && <span className="pill red">Captura inmediata</span>}
                <span className="pill">{item.status}</span>
              </div>
            </div>
            {(orderGroup || orderMoment || orderReason) && <div className="brief-box production-order-brief-note">
              <h4>Razón del orden</h4>
              {orderGroup && <><strong>Grupo:</strong> {orderGroup}{"\n"}</>}
              {orderMoment && <><strong>Momento ideal:</strong> {orderMoment}{"\n"}</>}
              {orderReason && <><strong>Motivo:</strong> {orderReason}</>}
            </div>}

            <div className="brief-columns">
              <div className="brief-box">
                <h4>Idea creativa</h4>
                {item.creativeIdea||"Sin idea creativa"}
              </div>
              <div className="brief-box">
                <h4>Notas para producción</h4>
                {item.productionNotes||"Sin notas específicas"}
              </div>
            </div>

            <div className="brief-columns">
              <div className="brief-box">
                <h4>Copy In / Mensaje</h4>
                <strong>Copy:</strong> {item.copyIn||"Sin copy"}{"\n"}
                <strong>Mensaje:</strong> {item.keyMessage||"Sin mensaje"}{"\n"}
                <strong>CTA:</strong> {item.cta||"Sin CTA"}
              </div>
              <div className="brief-box">
                <h4>Checklist de producción</h4>
                <div className="brief-shotlist">
                  <div className="brief-check">Capturar toma principal de la idea</div>
                  <div className="brief-check">Capturar recurso vertical para redes</div>
                  <div className="brief-check">Capturar detalle / close-up</div>
                  <div className="brief-check">Capturar toma de contexto / ambiente</div>
                  <div className="brief-check">Validar referencia antes de cerrar pieza</div>
                </div>
              </div>
            </div>

            {(refs.length>0 || referenceLinks.length>0) && <div>
              <h4 style={{margin:"0 0 10px",textTransform:"uppercase",color:"var(--muted)",fontSize:12}}>Referencias visuales</h4>
              {refs.length>0 && <div className="brief-ref-grid">
                {refs.map((file,i)=><div className="brief-ref" key={i}>
                  {isImageFile(file)?<img src={file.url} alt="Referencia"/>:isVideoFile(file)?<video src={file.url} muted playsInline preload="metadata"/>:<span className="mini">Archivo de referencia</span>}
                </div>)}
              </div>}
              {referenceLinks.map((link,i)=><a className="brief-link" href={link} target="_blank" key={i}>{link}</a>)}
            </div>}

            {materialLinks.length>0 && <div>
              <h4 style={{margin:"0 0 10px",textTransform:"uppercase",color:"var(--muted)",fontSize:12}}>Material final / edición</h4>
              {materialLinks.map((link,i)=><a className="brief-link" href={link} target="_blank" key={i}>{link}</a>)}
            </div>}
          </article>
        })}
        {!included.length && <p className="mini">Esta producción no tiene solicitudes ligadas.</p>}
      </div>
    </div>
  </section>;
}


function FileList({files,onPreview,onRemove}:{files:ReferenceFile[];onPreview:(file:ReferenceFile)=>void;onRemove:(index:number)=>void;}){
  return <div className="ref-grid">
    {(files||[]).map((file,index)=><button type="button" className="ref-thumb" onClick={()=>onPreview(file)} key={index}>
      {isImageFile(file)?<img src={file.url} alt="Material"/>:isVideoFile(file)?<video src={file.url} muted playsInline preload="metadata"/>:<div className="ref-thumb-file">Archivo</div>}
      <span className="ref-delete" onClick={(event)=>{event.stopPropagation();onRemove(index);}}>Eliminar</span>
    </button>)}
  </div>
}

function PreviewModal({file,onClose}:{file:ReferenceFile;onClose:()=>void}){
  return <div className="preview-modal" onClick={onClose}>
    <div className="preview-box" onClick={e=>e.stopPropagation()}>
      <div className="preview-actions"><strong>{file.name}</strong><button className="btn red" onClick={onClose}>Cerrar</button></div>
      {isImageFile(file)?<img src={file.url} alt={file.name}/>:isVideoFile(file)?<video src={file.url} controls playsInline/>:<p>Archivo no previsualizable.</p>}
    </div>
  </div>
}
