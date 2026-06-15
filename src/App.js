import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Loonie Icon — coin image ─────────────────────────────────────────────────
const LoonieIcon = ({ size = 24 }) => (
  <img
    src="/coin.png"
    width={size}
    height={size}
    alt="LoonieTrack"
    style={{display:"block",flexShrink:0,objectFit:"contain"}}
  />
);


const PERSONAL_CATS = [
  { id:"grocery",  label:"Grocery",       icon:"🛒", color:"#16A34A" },
  { id:"gas",      label:"Gas",           icon:"⛽", color:"#D97706" },
  { id:"food_out", label:"Entertainment", icon:"🎬", color:"#F97316" },
  { id:"car",      label:"Car",           icon:"🚗", color:"#2563EB", sub:"Lease · Insurance" },
  { id:"phone",    label:"Phone",         icon:"📱", color:"#0891B2", sub:"Rogers · Bell · Telus" },
  { id:"house",    label:"House",         icon:"🏠", color:"#7C3AED", sub:"Rent · Utilities · Hydro" },
  { id:"other",    label:"Others",        icon:"📌", color:"#9CA3AF" },
];
const CORP_CATS = [
  { id:"meals",       label:"Meals & Entertainment", icon:"🍽️", color:"#E11D48", deduct:50,  hstClaimable:true,  note:"50% deductible" },
  { id:"vehicle",     label:"Vehicle & Travel",      icon:"🚗", color:"#2563EB", deduct:100, hstClaimable:true,  note:"Mileage log required" },
  { id:"equipment",   label:"Equipment & Software",  icon:"💻", color:"#7C3AED", deduct:100, hstClaimable:true,  note:"100% deductible" },
  { id:"phone_biz",   label:"Phone & Internet",      icon:"📱", color:"#0891B2", deduct:100, hstClaimable:true,  note:"Business % only" },
  { id:"home_office", label:"Home Office",            icon:"🏠", color:"#059669", deduct:100, hstClaimable:true,  note:"% of home space" },
  { id:"marketing",   label:"Marketing & Ads",        icon:"📢", color:"#D97706", deduct:100, hstClaimable:true,  note:"100% deductible" },
  { id:"professional",label:"Professional Fees",      icon:"👔", color:"#6366F1", deduct:100, hstClaimable:false, note:"Legal · Accounting" },
  { id:"office_sup",  label:"Office Supplies",        icon:"📎", color:"#84CC16", deduct:100, hstClaimable:true,  note:"100% deductible" },
  { id:"other_biz",   label:"Other Business",         icon:"📌", color:"#9CA3AF", deduct:100, hstClaimable:true,  note:"" },
];
const TAX_TAGS = [
  { id:"medical",   label:"Medical",  icon:"🏥", line:"Line 33099", note:"Medical Expense Credit" },
  { id:"donations", label:"Donation", icon:"❤️", line:"Line 34900", note:"Charitable Donation Credit" },
  { id:"childcare", label:"Childcare",icon:"👶", line:"Line 21400", note:"T778 Childcare Deduction" },
  { id:"none",      label:"None",     icon:"",   line:"",           note:"" },
];

const FREE_LIMIT = 10;
const PLANS = {
  free:     { label:"Free",     price:0,    receipts:FREE_LIMIT, corp:false },
  personal: { label:"Personal", price:3.99, receipts:Infinity,   corp:false },
  business: { label:"Business", price:7.99, receipts:Infinity,   corp:true  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const gid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt  = (n) => new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(n||0);
const parseDate = (d) => { if(!d) return new Date(); if(d.includes("T")) return new Date(d); return new Date(d+"T12:00:00"); };
const fmtD = (d) => { const date=parseDate(d),now=new Date(),yest=new Date(); yest.setDate(now.getDate()-1); if(date.toDateString()===now.toDateString()) return "Today"; if(date.toDateString()===yest.toDateString()) return "Yesterday"; return date.toLocaleDateString("en-CA",{month:"short",day:"numeric"}); };
const pcat   = (id) => PERSONAL_CATS.find(c=>c.id===id)||PERSONAL_CATS[PERSONAL_CATS.length-1];
const ccat   = (id) => CORP_CATS.find(c=>c.id===id)||CORP_CATS[CORP_CATS.length-1];
const anyCat = (id,type) => type==="corp"?ccat(id):pcat(id);
const CONF   = 75;

// ─── Storage ───────────────────────────────────────────────────────────────────
const db = {
  get:    async (k) => { try { const r=await window.storage.get(k); return r?JSON.parse(r.value):null; } catch { return null; } },
  set:    async (k,v) => { try { await window.storage.set(k,JSON.stringify(v)); } catch {} },
  remove: async (k)   => { try { await window.storage.delete(k); } catch {} },
};

// ─── Period ────────────────────────────────────────────────────────────────────
const rangeOf = (p,cu) => {
  const n=new Date();
  if(p==="week")  { const s=new Date(n); const day=n.getDay()||7; s.setDate(n.getDate()-day+1); s.setHours(0,0,0,0); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return {s,e,label:"This Week"}; }
  if(p==="month") { const s=new Date(n.getFullYear(),n.getMonth(),1),e=new Date(n.getFullYear(),n.getMonth()+1,0,23,59,59,999); return {s,e,label:n.toLocaleDateString("en-CA",{month:"long",year:"numeric"})}; }
  if(p==="last")  { const s=new Date(n.getFullYear(),n.getMonth()-1,1),e=new Date(n.getFullYear(),n.getMonth(),0,23,59,59,999); return {s,e,label:s.toLocaleDateString("en-CA",{month:"long",year:"numeric"})}; }
  if(p==="year")  { const s=new Date(n.getFullYear(),0,1),e=new Date(n.getFullYear(),11,31,23,59,59,999); return {s,e,label:`${n.getFullYear()}`}; }
  if(p==="custom"&&cu.s&&cu.e) return {s:new Date(cu.s),e:new Date(cu.e+"T23:59:59"),label:`${cu.s} → ${cu.e}`};
  return rangeOf("month",{});
};

// ─── Claude API ────────────────────────────────────────────────────────────────
async function aiScan(b64,mime,type) {
  // Compress image - with timeout and error fallback so it never hangs
  const compressed = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(b64), 8000); // fallback: use original if takes too long
    const img = new Image();
    img.onerror = () => { clearTimeout(timer); resolve(b64); };
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale) || 800;
        canvas.height = Math.round(img.height * scale) || 600;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6).split(",")[1]);
      } catch(e) {
        resolve(b64);
      }
    };
    img.src = "data:" + (mime||"image/jpeg") + ";base64," + b64;
  });

  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ b64: compressed, mime: "image/jpeg", type })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({error: "Server error " + res.status}));
    throw new Error(err.error || "Server error");
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}





// ══════════════════════════════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════════════════════════════
const SHARED_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  ::-webkit-scrollbar{display:none}
  body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
  .btn{border:none;cursor:pointer;font-family:inherit;transition:all .12s}
  .btn:active{transform:scale(.97);opacity:.85}
  input[type=date]{color-scheme:light}
  textarea{font-family:inherit}
  @keyframes up{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes sheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
  @keyframes dot{from{opacity:.2;transform:scale(.7)}to{opacity:1;transform:scale(1.3)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
`;

// ══════════════════════════════════════════════════════════════════════════════
// AUTH SCREEN — light, same palette as home
// ══════════════════════════════════════════════════════════════════════════════
function AuthScreen({ onGuest, onAuth }) {
  const [mode,    setMode]   = useState("choice"); // choice | signin | signup
  const [name,    setName]   = useState("");
  const [contact, setContact]= useState("");
  const [pass,    setPass]   = useState("");
  const [showPass,setShowP]  = useState(false);
  const [err,     setErr]    = useState("");
  const [loading, setLoad]   = useState(false);

  const submit = async () => {
    if(mode==="signup"&&!name.trim()){setErr("Please enter your name");return;}
    if(!contact.trim()){setErr("Please enter your email or phone");return;}
    if(pass.length<6){setErr("Password must be at least 6 characters");return;}
    setLoad(true); setErr("");
    await new Promise(r=>setTimeout(r,700));
    const user={id:gid(),name:name||contact.split("@")[0],contact,plan:"free",joinedAt:new Date().toISOString()};
    await db.set("lt_user",user);
    setLoad(false); onAuth(user);
  };

  const inputStyle = {
    width:"100%",padding:"14px 16px",background:"#fff",
    border:"1.5px solid #E5E4E0",borderRadius:14,
    color:"#111",fontSize:15,fontFamily:"inherit",outline:"none",
    transition:"border-color .2s, box-shadow .2s",
  };

  return (
    <div style={{fontFamily:"'Inter',system-ui,-apple-system,sans-serif",background:"#F5F4F0",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",maxWidth:430,margin:"0 auto"}}>
      <style>{SHARED_CSS}</style>

      {/* Header — same as home nav */}
      <div style={{width:"100%",background:"rgba(245,244,240,.96)",backdropFilter:"blur(22px)",borderBottom:"1px solid #E8E7E3",padding:"14px 20px",display:"flex",alignItems:"center",gap:8}}>
        <LoonieIcon size={26}/>
        <span style={{fontSize:16,fontWeight:600,letterSpacing:"-.3px"}}>LoonieTrack</span>
        <span style={{fontSize:10,color:"#aaa",marginTop:2}}>🍁 Canada · Ontario</span>
      </div>

      <div style={{flex:1,width:"100%",padding:"32px 20px 40px",display:"flex",flexDirection:"column"}}>

        {/* CHOICE SCREEN */}
        {mode==="choice"&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{marginBottom:32}}>
              <div style={{fontSize:17,fontWeight:600,letterSpacing:'-.3px',marginBottom:8}}>
                Control your loonies,<br/>save millions.
              </div>
              <div style={{fontSize:14,color:"#888",lineHeight:1.7}}>
                Scan receipts, track expenses, and generate Ontario tax reports — personal and corporate.
              </div>
            </div>

            {/* Plans preview */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:32}}>
              {[
                {icon:"👤",label:"Guest",price:"Free",sub:"10 receipts/mo",color:"#9CA3AF"},
                {icon:"⭐",label:"Personal",price:"$3.99",sub:"/month · Unlimited",color:"#E84D0E"},
                {icon:"💼",label:"Business",price:"$7.99",sub:"Personal + Corp",color:"#4F46E5"},
              ].map((p,i)=>(
                <div key={i} style={{background:"#fff",borderRadius:16,padding:"14px 10px",textAlign:"center",boxShadow:"0 2px 12px rgba(0,0,0,.06)",border:`1.5px solid ${i===1?"rgba(232,77,14,.2)":"#E8E7E3"}`}}>
                  <div style={{fontSize:22,marginBottom:6}}>{p.icon}</div>
                  <div style={{fontSize:11,fontWeight:700,color:p.color,letterSpacing:".04em",marginBottom:4}}>{p.label.toUpperCase()}</div>
                  <div style={{fontSize:15,fontWeight:600}}>{p.price}</div>
                  <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{p.sub}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Sign up CTA */}
              <button className="btn" onClick={()=>setMode("signup")} style={{width:"100%",padding:"18px",borderRadius:18,background:"linear-gradient(135deg,#E84D0E,#F97316)",color:"#fff",fontSize:15,fontWeight:600,boxShadow:"0 8px 24px rgba(232,77,14,.3)"}}>
                Create Free Account →
              </button>
              {/* Sign in */}
              <button className="btn" onClick={()=>setMode("signin")} style={{width:"100%",padding:"16px",borderRadius:16,background:"#fff",border:"1.5px solid #E5E4E0",color:"#111",fontSize:14,fontWeight:600,boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                Sign In
              </button>
              {/* Guest */}
              <button className="btn" onClick={onGuest} style={{width:"100%",padding:"14px",borderRadius:14,background:"none",color:"#aaa",fontSize:13,fontWeight:600}}>
                Continue as Guest — {FREE_LIMIT} receipts/month
              </button>
            </div>
          </div>
        )}

        {/* SIGN IN / SIGN UP FORM */}
        {(mode==="signin"||mode==="signup")&&(
          <div style={{animation:"fadeUp .3s ease"}}>
            {/* Back */}
            <button className="btn" onClick={()=>{setMode("choice");setErr("");}} style={{display:"flex",alignItems:"center",gap:6,color:"#888",fontSize:13,fontWeight:600,background:"none",marginBottom:24,padding:0}}>
              ‹ Back
            </button>

            <div style={{fontSize:22,fontWeight:700,letterSpacing:'-.3px',marginBottom:6}}>
              {mode==="signup"?"Create account":"Welcome back"}
            </div>
            <div style={{fontSize:13,color:"#aaa",marginBottom:28}}>
              {mode==="signup"?"Start free — upgrade anytime":"Sign in to your account"}
            </div>

            {/* Toggle */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,background:"#ECEAE6",borderRadius:14,padding:4,marginBottom:24}}>
              {[{id:"signup",l:"Sign Up"},{id:"signin",l:"Sign In"}].map(t=>(
                <button key={t.id} className="btn" onClick={()=>{setMode(t.id);setErr("");}} style={{padding:"11px",borderRadius:11,fontSize:14,fontWeight:600,background:mode===t.id?"#fff":"none",color:mode===t.id?"#111":"#888",boxShadow:mode===t.id?"0 2px 8px rgba(0,0,0,.08)":"none"}}>
                  {t.l}
                </button>
              ))}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {mode==="signup"&&(
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#aaa",letterSpacing:".07em",marginBottom:7}}>YOUR NAME</div>
                  <input value={name} onChange={e=>{setName(e.target.value);setErr("");}} placeholder="John Smith" style={inputStyle}
                    onFocus={e=>{e.target.style.borderColor="#E84D0E";e.target.style.boxShadow="0 0 0 3px rgba(232,77,14,.08)";}}
                    onBlur={e=>{e.target.style.borderColor="#E5E4E0";e.target.style.boxShadow="none";}}/>
                </div>
              )}
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#aaa",letterSpacing:".07em",marginBottom:7}}>EMAIL OR PHONE</div>
                <input value={contact} onChange={e=>{setContact(e.target.value);setErr("");}} placeholder="john@email.com or 647-555-0123" inputMode="email" style={inputStyle}
                  onFocus={e=>{e.target.style.borderColor="#E84D0E";e.target.style.boxShadow="0 0 0 3px rgba(232,77,14,.08)";}}
                  onBlur={e=>{e.target.style.borderColor="#E5E4E0";e.target.style.boxShadow="none";}}/>
              </div>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#aaa",letterSpacing:".07em",marginBottom:7}}>PASSWORD</div>
                <div style={{position:"relative"}}>
                  <input type={showPass?"text":"password"} value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} placeholder="Min. 6 characters" style={{...inputStyle,paddingRight:48}}
                    onFocus={e=>{e.target.style.borderColor="#E84D0E";e.target.style.boxShadow="0 0 0 3px rgba(232,77,14,.08)";}}
                    onBlur={e=>{e.target.style.borderColor="#E5E4E0";e.target.style.boxShadow="none";}}/>
                  <button className="btn" onClick={()=>setShowP(s=>!s)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",color:"#aaa",fontSize:16,padding:4}}>{showPass?"🙈":"👁️"}</button>
                </div>
              </div>

              {err&&(
                <div style={{background:"#FFF3EE",border:"1.5px solid #FFD5C2",borderRadius:12,padding:"11px 14px",fontSize:13,color:"#B94A1A"}}>
                  ⚠️ {err}
                </div>
              )}

              <button className="btn" onClick={submit} disabled={loading} style={{width:"100%",padding:"16px",borderRadius:16,background:loading?"#E8E7E3":"linear-gradient(135deg,#E84D0E,#F97316)",color:loading?"#aaa":"#fff",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:loading?"none":"0 6px 20px rgba(232,77,14,.28)",transition:"all .2s"}}>
                {loading?<><div style={{width:18,height:18,border:"2px solid #ddd",borderTopColor:"#aaa",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>{mode==="signup"?"Creating…":"Signing in…"}</>:mode==="signup"?"Create Free Account →":"Sign In →"}
              </button>

              {mode==="signup"&&(
                <div style={{textAlign:"center",fontSize:12,color:"#bbb",lineHeight:1.7}}>
                  Free plan: {FREE_LIMIT} receipts/month<br/>
                  Upgrade to Pro Personal ($3.99/mo) for unlimited
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// UPGRADE MODAL
// ══════════════════════════════════════════════════════════════════════════════
function UpgradeModal({ reason, isGuest, onClose, onSignUp, onUpgrade }) {
  const isLimit = reason==="limit";
  return (
    <div style={{position:"fixed",inset:0,zIndex:400,fontFamily:"'Inter',system-ui,-apple-system,sans-serif"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.55)",backdropFilter:"blur(10px)"}} onClick={onClose}/>
      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#F5F4F0",borderRadius:"24px 24px 0 0",padding:"28px 20px 48px",animation:"sheet .25s ease",maxWidth:430,margin:"0 auto"}}>

        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:44,marginBottom:10}}>{isLimit?"🧾":"💼"}</div>
          <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>
            {isLimit?`${FREE_LIMIT}-receipt limit reached`:"Corporation — Pro feature"}
          </div>
          <div style={{fontSize:13,color:"#888",lineHeight:1.6}}>
            {isLimit&&isGuest?"Sign up free to reset each month, or go Pro for unlimited.":isLimit?"Upgrade to Pro Personal for unlimited receipts.":"Track business expenses, HST ITC, and T2 reports."}
          </div>
        </div>

        {/* Plans */}
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:22}}>
          {/* Pro Personal */}
          <div style={{background:"#fff",borderRadius:18,padding:"18px",border:"2px solid rgba(232,77,14,.25)",boxShadow:"0 4px 16px rgba(232,77,14,.1)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>⭐ Pro Personal</div>
                <div style={{fontSize:11,color:"#aaa",marginTop:2}}>Best for personal finances</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:19,fontWeight:600,color:"#E84D0E"}}>$3.99</div>
                <div style={{fontSize:10,color:"#aaa"}}>/month</div>
              </div>
            </div>
            {["Unlimited receipts","Full tax reports (T1)","Export for accountant","Personal categories"].map((f,i)=>(
              <div key={i} style={{fontSize:12,color:"#555",marginBottom:4}}>✓ {f}</div>
            ))}
            <button className="btn" onClick={()=>onUpgrade("personal")} style={{width:"100%",marginTop:12,padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#E84D0E,#F97316)",color:"#fff",fontSize:14,fontWeight:600,fontFamily:"'Inter',system-ui,-apple-system,sans-serif",boxShadow:"0 4px 16px rgba(232,77,14,.3)"}}>
              Upgrade to Personal — $3.99/mo
            </button>
          </div>

          {/* Pro Business */}
          <div style={{background:"#fff",borderRadius:18,padding:"18px",border:"1.5px solid #E5E4E0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>💼 Pro Business</div>
                <div style={{fontSize:11,color:"#aaa",marginTop:2}}>Includes everything in Personal</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:19,fontWeight:600,color:"#4F46E5"}}>$7.99</div>
                <div style={{fontSize:10,color:"#aaa"}}>/month</div>
              </div>
            </div>
            {["All Personal features ✓","Corporation expenses","T2 corporate tax report","HST quarterly return","HST ITC tracking"].map((f,i)=>(
              <div key={i} style={{fontSize:12,color:i===0?"#E84D0E":"#555",marginBottom:4,fontWeight:i===0?700:400}}>✓ {f}</div>
            ))}
            <button className="btn" onClick={()=>onUpgrade("business")} style={{width:"100%",marginTop:12,padding:"14px",borderRadius:14,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:14,fontWeight:600,fontFamily:"'Inter',system-ui,-apple-system,sans-serif"}}>
              Upgrade to Business — $7.99/mo
            </button>
          </div>
        </div>

        {/* Sign up option for guests */}
        {isGuest&&isLimit&&(
          <button className="btn" onClick={onSignUp} style={{width:"100%",padding:"14px",borderRadius:14,background:"#fff",border:"1.5px solid #E5E4E0",color:"#555",fontSize:14,fontWeight:600,marginBottom:10}}>
            📧 Sign up free — resets monthly limit
          </button>
        )}
        <button className="btn" onClick={onClose} style={{width:"100%",padding:"12px",background:"none",color:"#bbb",fontSize:13,fontWeight:600}}>
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMERA SCANNER — autofocus + 3s auto-capture timer
// ══════════════════════════════════════════════════════════════════════════════
function CameraScanner({ onCapture, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const countRef  = useRef(null);
  const [ready,     setReady]    = useState(false);
  const [captured,  setCaptured] = useState(null);
  const [flash,     setFlash]    = useState(false);
  const [err,       setErr]      = useState(null);
  const [countdown, setCountdown]= useState(null);
  const [autoOff,   setAutoOff]  = useState(false);

  useEffect(() => { startCam(); return () => { stopCam(); clearInterval(countRef.current); }; }, []);

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode:{ideal:"environment"}, width:{ideal:1920}, height:{ideal:1080} }
      });
      streamRef.current = s;
      const track = s.getVideoTracks()[0];
      try { await track.applyConstraints({advanced:[{focusMode:"continuous",exposureMode:"continuous",whiteBalanceMode:"continuous"}]}); } catch(_) {}
      if(videoRef.current) videoRef.current.srcObject = s;
    } catch(e) { setErr("Camera access denied — please allow camera in browser settings."); }
  };

  const stopCam = () => { streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; };

  const onVideoReady = () => { setReady(true); if(!autoOff) startCountdown(); };

  const startCountdown = () => {
    setCountdown(3); let n=3;
    countRef.current = setInterval(()=>{ n--; setCountdown(n); if(n<=0){ clearInterval(countRef.current); doCapture(); } },1000);
  };

  const cancelAuto = () => { clearInterval(countRef.current); setCountdown(null); setAutoOff(true); };

  const doCapture = () => {
    clearInterval(countRef.current);
    const v=videoRef.current, c=canvasRef.current; if(!v||!c) return;
    c.width=v.videoWidth||1280; c.height=v.videoHeight||720;
    c.getContext("2d").drawImage(v,0,0);
    setFlash(true); setTimeout(()=>setFlash(false),180);
    stopCam(); setCountdown(null);
    setCaptured(c.toDataURL("image/jpeg",.85));
  };

  const retake = () => { setCaptured(null); setReady(false); setCountdown(null); setAutoOff(false); startCam(); };

  const R=34, CIRC=2*Math.PI*R;
  const progress = countdown!==null ? ((3-countdown)/3)*CIRC : 0;

  const corners = [
    {top:0,left:0,borderTop:"3px solid rgba(255,255,255,.9)",borderLeft:"3px solid rgba(255,255,255,.9)",borderRadius:"14px 0 0 0"},
    {top:0,right:0,borderTop:"3px solid rgba(255,255,255,.9)",borderRight:"3px solid rgba(255,255,255,.9)",borderRadius:"0 14px 0 0"},
    {bottom:0,left:0,borderBottom:"3px solid rgba(255,255,255,.9)",borderLeft:"3px solid rgba(255,255,255,.9)",borderRadius:"0 0 0 14px"},
    {bottom:0,right:0,borderBottom:"3px solid rgba(255,255,255,.9)",borderRight:"3px solid rgba(255,255,255,.9)",borderRadius:"0 0 14px 0"},
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,background:"#000",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <canvas ref={canvasRef} style={{display:"none"}}/>
      {flash && <div style={{position:"absolute",inset:0,background:"#fff",opacity:.85,zIndex:20,pointerEvents:"none"}}/>}
      {!captured ? (
        <>
          <video ref={videoRef} autoPlay playsInline muted onCanPlay={onVideoReady} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          {err ? (
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,background:"rgba(0,0,0,.85)"}}>
              <div style={{fontSize:48,marginBottom:16}}>📷</div>
              <div style={{color:"#fff",fontSize:14,textAlign:"center",lineHeight:1.7,marginBottom:28}}>{err}</div>
              <button onClick={onClose} style={{padding:"12px 28px",borderRadius:14,background:"#fff",border:"none",fontWeight:600,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>← Go Back</button>
            </div>
          ) : (
            <>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                <div style={{width:"78%",aspectRatio:"1/1.7",borderRadius:14,boxShadow:"0 0 0 9999px rgba(0,0,0,.5)",position:"relative"}}>
                  {corners.map((s,i)=><div key={i} style={{position:"absolute",width:26,height:26,...s}}/>)}
                  {ready && countdown!==null && (
                    <div style={{position:"absolute",top:"50%",left:10,right:10,height:"2px",background:"linear-gradient(90deg,transparent,rgba(232,77,14,.9),transparent)",animation:"scanLine 1.5s ease-in-out infinite"}}/>
                  )}
                </div>
              </div>
              <div style={{position:"absolute",top:"8%",left:0,right:0,textAlign:"center"}}>
                <div style={{display:"inline-block",background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)",color:"#fff",fontSize:12,fontWeight:600,padding:"7px 18px",borderRadius:100}}>
                  {!ready ? "Starting camera…" : countdown!==null ? `Auto-capture in ${countdown}s — tap to stop` : "Tap 📷 to capture"}
                </div>
              </div>
              <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"20px 32px 52px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(transparent,rgba(0,0,0,.7))"}}>
                <button onClick={onClose} style={{color:"rgba(255,255,255,.85)",background:"none",border:"none",fontSize:14,fontWeight:600,cursor:"pointer",padding:12,fontFamily:"inherit",minWidth:70}}>Cancel</button>
                <div style={{position:"relative",width:80,height:80,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {countdown!==null && (
                    <svg style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}} width="80" height="80">
                      <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3"/>
                      <circle cx="40" cy="40" r={R} fill="none" stroke="#E84D0E" strokeWidth="3.5"
                        strokeDasharray={`${progress} ${CIRC}`} strokeLinecap="round"
                        style={{transition:"stroke-dasharray .95s linear"}}/>
                    </svg>
                  )}
                  <button onClick={countdown!==null ? cancelAuto : doCapture} disabled={!ready}
                    style={{width:64,height:64,borderRadius:"50%",background:ready?"#fff":"rgba(255,255,255,.4)",border:"none",
                      cursor:ready?"pointer":"not-allowed",fontWeight:700,color:"#111",
                      boxShadow:ready?"0 4px 20px rgba(0,0,0,.5)":"none",transition:"all .2s",fontFamily:"inherit",
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:countdown!==null?22:26}}>
                    {countdown!==null ? (countdown||"📷") : "📷"}
                  </button>
                </div>
                <div style={{minWidth:70,textAlign:"right"}}>
                  {autoOff && <button onClick={startCountdown} style={{color:"rgba(255,255,255,.7)",background:"none",border:"1px solid rgba(255,255,255,.3)",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",padding:"8px 10px",fontFamily:"inherit"}}>Auto ↺</button>}
                </div>
              </div>
              <button onClick={onClose} style={{position:"absolute",top:16,right:16,width:34,height:34,borderRadius:"50%",background:"rgba(0,0,0,.45)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
            </>
          )}
        </>
      ) : (
        <>
          <img src={captured} alt="" style={{width:"100%",height:"100%",objectFit:"contain",background:"#111"}}/>
          <div style={{position:"absolute",top:16,left:0,right:0,textAlign:"center"}}>
            <div style={{display:"inline-block",background:"rgba(0,0,0,.6)",color:"#fff",fontSize:12,fontWeight:600,padding:"6px 16px",borderRadius:100}}>Check photo is clear and readable</div>
          </div>
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"20px 24px 52px",background:"linear-gradient(transparent,rgba(0,0,0,.8))",display:"flex",gap:12}}>
            <button onClick={retake} style={{flex:1,padding:"16px",borderRadius:16,background:"rgba(255,255,255,.15)",color:"#fff",border:"1.5px solid rgba(255,255,255,.25)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>🔄 Retake</button>
            <button onClick={()=>onCapture(captured,"image/jpeg")} style={{flex:2,padding:"16px",borderRadius:16,background:"linear-gradient(135deg,#E84D0E,#F97316)",color:"#fff",border:"none",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 20px rgba(232,77,14,.45)"}}>✓ Use Photo</button>
          </div>
        </>
      )}
      <style>{`@keyframes scanLine{0%,100%{opacity:0;transform:translateY(-8px)}50%{opacity:1;transform:translateY(8px)}}`}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
function MainApp({ user, onSignOut, onGoAuth }) {
  const plan    = PLANS[user?.plan||"free"];
  const isPro   = user?.plan==="personal"||user?.plan==="business";
  const hasCorp = user?.plan==="business";
  const isGuest = !user?.id;

  const [tab,     setTab]   = useState("home");
  const [txns,    setTxns]  = useState([]);
  const [ready,   setRdy]   = useState(false);
  const [scanning,setScan]  = useState(false);
  const [preview, setPrev]  = useState(null);
  const [pending, setPend]  = useState(null);
  const [undo,    setUndo]  = useState(null);
  const [manual,  setManual]= useState(null);
  const [drill,   setDrill] = useState(null);
  const [viewImg, setViewImg] = useState(null);
  const [period,  setPer]   = useState("month");
  const [cust,    setCust]  = useState({s:"",e:""});
  const [taxView, setTaxV]  = useState("personal");
  const [repView, setRepV]  = useState("personal");
  const [showCamera,setCamera] = useState(false);
  const [typeModal,setTypeM]= useState(false);
  const [pendFile,setPendF] = useState(null);
  const [upgrade, setUpgrade]=useState(null);
  const [showProf,setShowP] = useState(false);
  const undoT = useRef();

  useEffect(()=>{ db.get("ft5_txns").then(t=>{setTxns(t||[]);setRdy(true);}); },[]);

  const commit = async (l) => { setTxns(l); await db.set("ft5_txns",l); };
  const now = new Date();
  const monthUsed = txns.filter(t=>{ const td=parseDate(t.date||t.at); return td.getMonth()===now.getMonth()&&td.getFullYear()===now.getFullYear(); }).length;

  const addTxn = async (d) => {
    if(!isPro && monthUsed>=FREE_LIMIT){ setUpgrade("limit"); return; }
    const t={id:gid(),at:new Date().toISOString(),...d};
    const next=[t,...txns]; await commit(next);
    setUndo(t); clearTimeout(undoT.current); undoT.current=setTimeout(()=>setUndo(null),5000);
  };
  const doUndo = async () => { if(!undo) return; await commit(txns.filter(t=>t.id!==undo.id)); setUndo(null); };
  const del    = async (id) => commit(txns.filter(t=>t.id!==id));

  // Resize image to max 1000px wide before sending — reduces payload 4-8x
  const onFile = (file) => {
    if(!file) return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      const url=e.target.result;
      setPrev(url); setPendF({b64:url.split(",")[1],mime:file.type||"image/jpeg"}); setTypeM(true);
    };
    reader.readAsDataURL(file);
  };

  const onCameraCapture = (dataUrl, mime) => {
    setCamera(false);
    setPrev(dataUrl);
    setPendF({b64: dataUrl.split(",")[1], mime: mime||"image/jpeg"});
    setTypeM(true);
  };

  const onTypeChosen = async (type) => {
    if(type==="corp"&&!hasCorp){ setTypeM(false); setPrev(null); setPendF(null); setUpgrade("corp"); return; }
    setTypeM(false); setScan(true);
    const img = prev;
    try {
      const r=await aiScan(pendFile.b64,pendFile.mime,type);
      if((r.confidence||0)>=CONF){ await addTxn({merchant:r.merchant||"Receipt",amount:r.amount,hst:r.hst,date:r.date||new Date().toISOString().slice(0,10),category:r.category||(type==="corp"?"other_biz":"other"),taxTag:r.taxTag||"none",type,img}); setPrev(null); }
      else { setPend({data:r,sugCat:r.category||(type==="corp"?"other_biz":"other"),type,img}); }
    } catch(err) { setPend({data:{merchant:"",amount:null},sugCat:type==="corp"?"other_biz":"other",type,err:String(err),img}); }
    finally { setScan(false); setPendF(null); }
  };

  const confirm = async (catId) => {
    const {data,type,img}=pending; setPend(null); setPrev(null);
    await addTxn({merchant:data?.merchant||"Expense",amount:data?.amount,hst:data?.hst,date:data?.date||new Date().toISOString().slice(0,10),category:catId,taxTag:data?.taxTag||"none",type,img});
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const wr=rangeOf("week",{});
  const weekTxns=txns.filter(t=>{const d=parseDate(t.date||t.at);return d>=wr.s&&d<=wr.e;});
  const weekP=weekTxns.filter(t=>t.type!=="corp").reduce((s,t)=>s+(t.amount||0),0);
  const weekC=weekTxns.filter(t=>t.type==="corp").reduce((s,t)=>s+(t.amount||0),0);
  const {s:ps,e:pe,label:pLabel}=rangeOf(period,cust);
  const inP=txns.filter(t=>{const d=parseDate(t.date||t.at);return d>=ps&&d<=pe;});
  const inPP=inP.filter(t=>t.type!=="corp"),inPC=inP.filter(t=>t.type==="corp");
  const pTotalP=inPP.reduce((s,t)=>s+(t.amount||0),0),pTotalC=inPC.reduce((s,t)=>s+(t.amount||0),0);
  const yr=new Date().getFullYear();
  const allYr=txns.filter(t=>parseDate(t.date||t.at).getFullYear()===yr);
  const persYr=allYr.filter(t=>t.type!=="corp"),corpYr=allYr.filter(t=>t.type==="corp");
  const medTotal=persYr.filter(t=>t.taxTag==="medical").reduce((s,t)=>s+(t.amount||0),0);
  const medThreshold=60000*0.03,medClaimable=Math.max(0,medTotal-medThreshold);
  const donTotal=persYr.filter(t=>t.taxTag==="donations").reduce((s,t)=>s+(t.amount||0),0);
  const donCredit=donTotal>0?Math.min(donTotal,200)*0.15+Math.max(0,donTotal-200)*0.29:0;
  const chdTotal=persYr.filter(t=>t.taxTag==="childcare").reduce((s,t)=>s+(t.amount||0),0);
  const corpBycat=CORP_CATS.map(c=>{const items=corpYr.filter(t=>t.category===c.id);const gross=items.reduce((s,t)=>s+(t.amount||0),0);const hst=items.reduce((s,t)=>s+(t.hst||0),0);return {...c,gross,hst,deductible:gross*(c.deduct/100),count:items.length,items};}).filter(c=>c.gross>0);
  const corpGrossTotal=corpBycat.reduce((s,c)=>s+c.gross,0),corpDeductTotal=corpBycat.reduce((s,c)=>s+c.deductible,0),corpHSTTotal=corpBycat.filter(c=>c.hstClaimable).reduce((s,c)=>s+c.hst,0);
  const qData=["Q1 (Jan–Mar)","Q2 (Apr–Jun)","Q3 (Jul–Sep)","Q4 (Oct–Dec)"].map((label,qi)=>({label,hst:corpYr.filter(t=>{const m=parseDate(t.date||t.at).getMonth();return m>=qi*3&&m<qi*3+3;}).reduce((s,t)=>s+(t.hst||0),0)}));
  const bar6=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-(5-i));const m=d.getMonth(),y=d.getFullYear();return {month:d.toLocaleDateString("en-CA",{month:"short"}),total:txns.filter(t=>{const td=parseDate(t.date||t.at);return td.getMonth()===m&&td.getFullYear()===y;}).reduce((s,t)=>s+(t.amount||0),0)};});
  const groups=(()=>{const g={};txns.slice(0,40).forEach(t=>{const k=fmtD(t.date||t.at);(g[k]=g[k]||[]).push(t);});return Object.entries(g).slice(0,7);})();

  const planColor = isPro?(hasCorp?"#4F46E5":"#E84D0E"):"#9CA3AF";
  const planLabel = isPro?(hasCorp?"Business":"Personal"):(isGuest?"Guest":"Free");

  return (
    <div style={{fontFamily:"'Inter',system-ui,-apple-system,sans-serif",background:"#F5F4F0",minHeight:"100vh",color:"#111",maxWidth:430,margin:"0 auto",position:"relative",overflowX:"hidden"}}>
      <style>{SHARED_CSS}</style>

      {/* ── TOP NAV ─────────────────────────────────────────────── */}
      <div style={{position:"fixed",top:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(245,244,240,.96)",backdropFilter:"blur(22px)",borderBottom:"1px solid #E8E7E3",display:"flex",alignItems:"center",padding:"10px 14px",zIndex:100,gap:4}}>
        <div style={{display:"flex",alignItems:"center",gap:7,marginRight:"auto"}}>
          <LoonieIcon size={22}/>
          <span style={{fontSize:14,fontWeight:600,letterSpacing:"-.3px"}}>LoonieTrack</span>
          {isPro&&<span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:100,background:hasCorp?"linear-gradient(135deg,#4F46E5,#7C3AED)":"linear-gradient(135deg,#E84D0E,#F97316)",color:"#fff",letterSpacing:".04em"}}>{hasCorp?"BUSINESS":"PERSONAL"}</span>}
        </div>
        {[{id:"home",icon:"🏠",l:"Home"},{id:"reports",icon:"📊",l:"Reports"},{id:"tax",icon:"🍁",l:"Tax"}].map(v=>(
          <button key={v.id} className="btn" onClick={()=>setTab(v.id)} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:100,background:tab===v.id?"#111":"none",border:"none",color:tab===v.id?"#fff":"#aaa",fontFamily:"inherit",fontSize:11,fontWeight:700,transition:"all .15s"}}>
            <span style={{fontSize:14}}>{v.icon}</span>{v.l}
          </button>
        ))}
        <button className="btn" onClick={()=>setShowP(s=>!s)} style={{width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${planColor},${planColor}99)`,border:"none",color:"#fff",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:4,flexShrink:0}}>
          {isGuest?"?":(user.name?.[0]?.toUpperCase()||"U")}
        </button>
      </div>

      {/* Profile dropdown */}
      {showProf&&(
        <>
          <div style={{position:"fixed",inset:0,zIndex:190}} onClick={()=>setShowP(false)}/>
          <div style={{position:"fixed",top:58,right:Math.max(0,(window.innerWidth-430)/2)+8,zIndex:200,background:"#fff",borderRadius:16,padding:"8px",boxShadow:"0 8px 32px rgba(0,0,0,.12)",border:"1px solid #E8E7E3",minWidth:210,animation:"fadeIn .15s"}}>
            <div style={{padding:"12px 14px 10px",borderBottom:"1px solid #F0EFEC"}}>
              <div style={{fontSize:14,fontWeight:600}}>{isGuest?"Guest":(user.name||"User")}</div>
              <div style={{fontSize:12,color:"#aaa",marginTop:2}}>{isGuest?"No account":user.contact}</div>
              <div style={{marginTop:8,display:"inline-flex",padding:"3px 10px",borderRadius:100,background:isPro?"linear-gradient(135deg,#E84D0E,#F97316)":"#F3F3F1",color:isPro?"#fff":"#888",fontSize:11,fontWeight:700}}>{planLabel} Plan{isPro?"":" · "+monthUsed+"/"+FREE_LIMIT+" used"}</div>
            </div>
            {!isPro&&<button className="btn" onClick={()=>{setShowP(false);setUpgrade("corp");}} style={{width:"100%",padding:"11px 14px",textAlign:"left",fontSize:13,fontWeight:600,color:"#E84D0E",background:"none",borderRadius:8,display:"flex",alignItems:"center",gap:8}}>⭐ Upgrade to Pro</button>}
            {isGuest
              ? <button className="btn" onClick={()=>{setShowP(false);onGoAuth();}} style={{width:"100%",padding:"11px 14px",textAlign:"left",fontSize:13,fontWeight:600,color:"#555",background:"none",borderRadius:8}}>📧 Sign Up / Sign In</button>
              : <button className="btn" onClick={async()=>{await db.remove("lt_user");onSignOut();}} style={{width:"100%",padding:"11px 14px",textAlign:"left",fontSize:13,fontWeight:600,color:"#888",background:"none",borderRadius:8}}>🚪 Sign Out</button>
            }
          </div>
        </>
      )}

      {/* ── CAMERA SCANNER ──────────────────────────────────────── */}
      {showCamera && <CameraScanner onCapture={onCameraCapture} onClose={()=>setCamera(false)}/>}

      {/* ── RECEIPT IMAGE VIEWER ──────────────────────────────────── */}
      {viewImg&&(
        <div style={{position:"fixed",inset:0,zIndex:600,background:"#000",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .15s"}} onClick={()=>setViewImg(null)}>
          <img src={viewImg} alt="Receipt" style={{maxWidth:"94%",maxHeight:"88%",objectFit:"contain",borderRadius:8,boxShadow:"0 8px 40px rgba(0,0,0,.5)"}}/>
          <button onClick={()=>setViewImg(null)} style={{position:"absolute",top:18,right:18,width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.15)",border:"none",color:"#fff",fontSize:17,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          <div style={{position:"absolute",bottom:28,left:0,right:0,textAlign:"center",color:"rgba(255,255,255,.6)",fontSize:12,fontWeight:600}}>Tap anywhere to close</div>
        </div>
      )}

      {/* ── OVERLAYS ─────────────────────────────────────────────── */}
      {scanning&&(
        <div style={{position:"fixed",inset:0,background:"rgba(245,244,240,.97)",zIndex:300,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,animation:"fadeIn .2s"}}>
          {preview&&<img src={preview} alt="" style={{width:180,height:140,objectFit:"cover",borderRadius:18,boxShadow:"0 12px 40px rgba(0,0,0,.18)"}}/>}
          <div style={{display:"flex",gap:8}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:"#111",animation:`dot .8s ${i*.2}s ease-in-out infinite alternate`}}/>)}</div>
          <div style={{fontSize:17,fontWeight:600}}>Reading receipt…</div>
        </div>
      )}

      {typeModal&&(
        <div style={{position:"fixed",inset:0,zIndex:250}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(8px)",animation:"fadeIn .2s"}} onClick={()=>{setTypeM(false);setPrev(null);setPendF(null);}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#F5F4F0",borderRadius:"24px 24px 0 0",padding:"32px 20px 48px",animation:"sheet .25s ease"}}>
            {preview&&<img src={preview} alt="" style={{width:"100%",height:110,objectFit:"cover",borderRadius:14,marginBottom:22}}/>}
            <div style={{fontSize:19,fontWeight:600,marginBottom:6}}>Who paid for this?</div>
            <div style={{fontSize:13,color:"#888",marginBottom:24}}>Determines which account and tax report it goes to.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[{type:"personal",icon:"👤",title:"Personal",sub:"My own money\nT1 Return",bg:"#FFF3EE"},{type:"corp",icon:"💼",title:"Corporation",sub:"Company card\nT2 · HST ITC",bg:"#EEF2FF",locked:!hasCorp}].map(o=>(
                <button key={o.type} className="btn" onClick={()=>onTypeChosen(o.type)} style={{padding:"22px 14px",borderRadius:18,background:"#fff",border:"2px solid #E8E7E3",display:"flex",flexDirection:"column",alignItems:"center",gap:8,boxShadow:"0 3px 16px rgba(0,0,0,.07)",position:"relative",opacity:o.locked?.85:1}}>
                  {o.locked&&<div style={{position:"absolute",top:-8,right:-8,background:"linear-gradient(135deg,#E84D0E,#F97316)",borderRadius:100,padding:"3px 9px",fontSize:9,fontWeight:700,color:"#fff"}}>PRO</div>}
                  <div style={{width:52,height:52,borderRadius:16,background:o.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{o.icon}</div>
                  <div style={{fontSize:14,fontWeight:600}}>{o.title}</div>
                  <div style={{fontSize:11,color:"#aaa",textAlign:"center",lineHeight:1.5,whiteSpace:"pre-line"}}>{o.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {pending&&!scanning&&(
        <div style={{position:"fixed",inset:0,zIndex:200}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.45)",backdropFilter:"blur(6px)",animation:"fadeIn .2s"}} onClick={()=>{setPend(null);setPrev(null);}}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#F5F4F0",borderRadius:"24px 24px 0 0",padding:"28px 20px 44px",maxHeight:"86vh",overflowY:"auto",animation:"sheet .25s ease"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:100,marginBottom:14,background:pending.type==="corp"?"#EEF2FF":"#FFF3EE",fontSize:12,fontWeight:700,color:pending.type==="corp"?"#4338CA":"#B94A1A"}}>{pending.type==="corp"?"💼 Corporation":"👤 Personal"}</div>
            {pending.err&&<div style={{background:"#FFF3EE",border:"1.5px solid #FFD5C2",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:11,color:"#B94A1A",wordBreak:"break-all"}}>⚠️ Debug: {pending.err}</div>}
            <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>What was this for?</div>
            <div style={{fontSize:13,color:"#888",marginBottom:20}}>{pending.data?.merchant?`${pending.data.merchant}${pending.data.amount?` · ${fmt(pending.data.amount)}`:""}`:"Pick a category"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {(pending.type==="corp"?CORP_CATS:PERSONAL_CATS).map((c,i)=>(
                <button key={c.id} className="btn" onClick={()=>confirm(c.id)} style={{padding:"13px 11px",borderRadius:14,textAlign:"left",display:"flex",alignItems:"flex-start",gap:9,background:i===0?`${c.color}12`:"#fff",border:i===0?`2px solid ${c.color}`:"2px solid transparent",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                  <span style={{fontSize:19}}>{c.icon}</span>
                  <div>{i===0&&<div style={{fontSize:9,fontWeight:700,color:c.color,letterSpacing:".07em",marginBottom:1}}>SUGGESTED</div>}<div style={{fontSize:12,fontWeight:700,lineHeight:1.3}}>{c.label}</div></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {manual&&(
        <div style={{position:"fixed",inset:0,zIndex:250}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(8px)",animation:"fadeIn .2s"}} onClick={()=>setManual(null)}/>
          <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#F5F4F0",borderRadius:"24px 24px 0 0",padding:"24px 20px 40px",maxHeight:"92vh",overflowY:"auto",animation:"sheet .25s ease"}}>
            <div style={{fontSize:19,fontWeight:600,marginBottom:16}}>✏️ Add Expense</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,background:"#ECEAE6",borderRadius:14,padding:4,marginBottom:16}}>
              {[{id:"personal",l:"👤 Personal"},{id:"corp",l:"💼 Corp"}].map(v=>(
                <button key={v.id} className="btn" onClick={()=>{if(v.id==="corp"&&!hasCorp){setManual(null);setUpgrade("corp");return;}setManual(m=>({...m,type:v.id,category:v.id==="corp"?"meals":"grocery"}));}} style={{padding:"10px",borderRadius:11,fontSize:12,fontWeight:700,border:"none",background:manual.type===v.id?"#fff":"none",color:manual.type===v.id?"#111":"#aaa",boxShadow:manual.type===v.id?"0 2px 8px rgba(0,0,0,.08)":"none",position:"relative"}}>
                  {v.l}{v.id==="corp"&&!hasCorp&&<span style={{fontSize:9,background:"#E84D0E",color:"#fff",borderRadius:100,padding:"1px 5px",marginLeft:4}}>PRO</span>}
                </button>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div><div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:".06em",marginBottom:5}}>MERCHANT</div><input value={manual.merchant} onChange={e=>setManual(m=>({...m,merchant:e.target.value}))} placeholder="e.g. Loblaws" style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E4E0",borderRadius:12,fontSize:14,fontFamily:"inherit",background:"#fff",outline:"none"}}/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div><div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:".06em",marginBottom:5}}>AMOUNT $</div><input type="number" inputMode="decimal" value={manual.amount} onChange={e=>setManual(m=>({...m,amount:e.target.value}))} placeholder="0.00" style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E4E0",borderRadius:12,fontSize:14,fontFamily:"inherit",background:"#fff",outline:"none"}}/></div>
                <div><div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:".06em",marginBottom:5}}>HST $</div><input type="number" inputMode="decimal" value={manual.hst} onChange={e=>setManual(m=>({...m,hst:e.target.value}))} placeholder="0.00" style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E4E0",borderRadius:12,fontSize:14,fontFamily:"inherit",background:"#fff",outline:"none"}}/></div>
              </div>
              <div><div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:".06em",marginBottom:5}}>DATE</div><input type="date" value={manual.date} onChange={e=>setManual(m=>({...m,date:e.target.value}))} style={{width:"100%",padding:"12px 14px",border:"1.5px solid #E5E4E0",borderRadius:12,fontSize:14,fontFamily:"inherit",background:"#fff",outline:"none"}}/></div>
              <div><div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:".06em",marginBottom:7}}>CATEGORY</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {(manual.type==="corp"?CORP_CATS:PERSONAL_CATS).map(c=>(
                    <button key={c.id} className="btn" onClick={()=>setManual(m=>({...m,category:c.id}))} style={{padding:"10px",borderRadius:11,textAlign:"left",display:"flex",alignItems:"center",gap:7,background:manual.category===c.id?`${c.color}14`:"#fff",border:manual.category===c.id?`2px solid ${c.color}`:"2px solid #E5E4E0"}}>
                      <span style={{fontSize:16}}>{c.icon}</span><span style={{fontSize:12,fontWeight:700}}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              {manual.type==="personal"&&(
                <div><div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:".06em",marginBottom:7}}>TAX TAG</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {TAX_TAGS.map(tg=><button key={tg.id} className="btn" onClick={()=>setManual(m=>({...m,taxTag:tg.id}))} style={{padding:"7px 13px",borderRadius:100,fontSize:12,fontWeight:700,background:manual.taxTag===tg.id?"#111":"#fff",color:manual.taxTag===tg.id?"#fff":"#888",border:"1.5px solid #E5E4E0"}}>{tg.icon} {tg.label}</button>)}
                  </div>
                </div>
              )}
              <button className="btn" disabled={!manual.amount} onClick={async()=>{await addTxn({merchant:manual.merchant||"Expense",amount:parseFloat(manual.amount)||0,hst:parseFloat(manual.hst)||0,date:manual.date,category:manual.category,taxTag:manual.taxTag||"none",type:manual.type});setManual(null);}} style={{width:"100%",padding:"16px",borderRadius:14,background:manual.amount?"linear-gradient(135deg,#E84D0E,#F97316)":"#E0DFDB",color:manual.amount?"#fff":"#aaa",fontSize:14,fontWeight:600,marginTop:4}}>
                💾 Save Expense
              </button>
            </div>
          </div>
        </div>
      )}

      {drill&&(()=>{
        const c=drill.type==="corp"?ccat(drill.catId):pcat(drill.catId);
        const items=inP.filter(t=>t.category===drill.catId&&(drill.type==="corp"?t.type==="corp":t.type!=="corp"));
        const total=items.reduce((s,t)=>s+(t.amount||0),0);
        return (
          <div style={{position:"fixed",inset:0,zIndex:250}}>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(8px)",animation:"fadeIn .2s"}} onClick={()=>setDrill(null)}/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#F5F4F0",borderRadius:"24px 24px 0 0",maxHeight:"88vh",display:"flex",flexDirection:"column",animation:"sheet .25s ease"}}>
              <div style={{padding:"22px 20px 14px",borderBottom:"1px solid #E8E7E3"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:46,height:46,borderRadius:14,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{c.icon}</div>
                    <div><div style={{fontSize:17,fontWeight:600}}>{c.label}</div><div style={{fontSize:12,color:"#aaa",marginTop:1}}>{pLabel} · {items.length} transaction{items.length!==1?"s":""}</div></div>
                  </div>
                  <button className="btn" onClick={()=>setDrill(null)} style={{background:"#ECEAE6",border:"none",borderRadius:10,padding:"7px 12px",fontSize:13,fontWeight:600,color:"#555"}}>✕</button>
                </div>
                <div style={{marginTop:12,padding:"11px 14px",background:`${c.color}10`,borderRadius:11,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:13,fontWeight:600,color:"#555"}}>Total</span>
                  <span style={{fontSize:17,fontWeight:600}}>{fmt(total)}</span>
                </div>
              </div>
              <div style={{overflowY:"auto",flex:1,padding:"10px 20px 32px"}}>
                {items.length===0&&<div style={{textAlign:"center",padding:"36px 0",color:"#aaa",fontSize:13}}>No transactions this period</div>}
                {items.map((t,i)=>(
                  <div key={t.id} onClick={()=>t.img&&setViewImg(t.img)} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderBottom:i<items.length-1?"1px solid #F0EFEC":"none",cursor:t.img?"pointer":"default"}}>
                    {t.img&&<img src={t.img} alt="" style={{width:36,height:36,borderRadius:10,objectFit:"cover",flexShrink:0,border:"1px solid #F0EFEC"}}/>}
                    <div style={{flex:1}}><div style={{fontSize:14,fontWeight:600}}>{t.merchant||c.label}</div><div style={{fontSize:12,color:"#aaa",marginTop:1}}>{fmtD(t.date||t.at)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:600}}>{fmt(t.amount)}</div>{t.hst>0&&<div style={{fontSize:11,color:"#aaa",marginTop:1}}>HST {fmt(t.hst)}</div>}</div>
                    <button className="btn" onClick={async(e)=>{e.stopPropagation();await del(t.id);setDrill(d=>({...d}));}} style={{background:"none",color:"#ddd",fontSize:18,padding:"2px 6px"}}>×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {upgrade&&<UpgradeModal reason={upgrade} isGuest={isGuest} onClose={()=>setUpgrade(null)} onSignUp={()=>{setUpgrade(null);onGoAuth();}} onUpgrade={(plan)=>{alert(`Stripe Checkout coming soon!\n\n${plan==="personal"?"Personal Plan — $3.99/month":"Business Plan — $7.99/month"}\n\nIn production this opens Stripe.`);setUpgrade(null);}}/>}

      {undo&&(
        <div style={{position:"fixed",bottom:24,left:12,right:12,zIndex:150,background:"#111",color:"#fff",borderRadius:16,padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 6px 28px rgba(0,0,0,.25)",animation:"up .25s ease"}}>
          <div><div style={{fontSize:13,fontWeight:600}}>✓ {undo.type==="corp"?"💼":"👤"} {anyCat(undo.category,undo.type).icon} {anyCat(undo.category,undo.type).label}</div><div style={{fontSize:12,color:"#666",marginTop:1}}>{undo.merchant} · {fmt(undo.amount)}</div></div>
          <button className="btn" onClick={doUndo} style={{background:"rgba(255,255,255,.13)",color:"#fff",padding:"6px 13px",borderRadius:8,fontSize:13,fontWeight:600}}>Undo</button>
        </div>
      )}

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div style={{paddingTop:56,paddingBottom:20}}>

        {/* ══ HOME ══ */}
        {tab==="home"&&(
          <div style={{padding:"16px 16px 0"}}>
            {/* Free usage bar */}
            {!isPro&&(
              <div onClick={()=>setUpgrade("limit")} style={{background:"#fff",borderRadius:14,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12,boxShadow:"0 2px 10px rgba(0,0,0,.05)",cursor:"pointer",border:"1.5px solid #E8E7E3"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:5}}>{isGuest?"Guest":"Free"} · {monthUsed}/{FREE_LIMIT} receipts this month</div>
                  <div style={{height:5,background:"#F0EFEC",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(100,monthUsed/FREE_LIMIT*100)}%`,background:monthUsed>=FREE_LIMIT?"#EF4444":"linear-gradient(90deg,#E84D0E,#F97316)",borderRadius:3,transition:"width .5s"}}/>
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:700,color:"#E84D0E",whiteSpace:"nowrap"}}>Go Pro ›</div>
              </div>
            )}

            <div style={{fontSize:11,fontWeight:700,color:"#aaa",letterSpacing:".08em",marginBottom:12}}>RECENT</div>
            {!ready&&<div style={{textAlign:"center",padding:40,color:"#ccc",fontSize:13}}>Loading…</div>}
            {ready&&txns.length===0&&(
              <div style={{textAlign:"center",padding:"20px 0 16px"}}>
                <div style={{fontSize:36,marginBottom:10}}>🧾</div>
                <div style={{fontSize:16,fontWeight:600,marginBottom:4}}>No expenses yet</div>
                <div style={{fontSize:12,color:"#aaa"}}>Add your first expense below</div>
              </div>
            )}
            {groups.map(([label,dayTxns])=>(
              <div key={label} style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:"#bbb",letterSpacing:".06em",marginBottom:7}}>{label}</div>
                <div style={{background:"#fff",borderRadius:18,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
                  {dayTxns.map((t,i)=>{const c=anyCat(t.category,t.type);const isCorp=t.type==="corp";return(
                    <div key={t.id} onClick={()=>t.img&&setViewImg(t.img)} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<dayTxns.length-1?"1px solid #F3F3F1":"none",cursor:t.img?"pointer":"default"}}>
                      {t.img
                        ? <img src={t.img} alt="" style={{width:42,height:42,borderRadius:13,objectFit:"cover",flexShrink:0,border:"1px solid #F0EFEC"}}/>
                        : <div style={{width:42,height:42,borderRadius:13,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.icon}</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <div style={{fontSize:14,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.merchant||c.label}</div>
                          <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:100,flexShrink:0,background:isCorp?"#EEF2FF":"#F3F4F6",color:isCorp?"#4338CA":"#9CA3AF"}}>{isCorp?"Corp":"Personal"}</span>
                        </div>
                        <div style={{fontSize:12,color:"#aaa"}}>{c.label}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:14,fontWeight:600}}>{fmt(t.amount)}</div>
                        {t.hst>0&&<div style={{fontSize:10,color:isCorp?"#4338CA":"#bbb",marginTop:1}}>HST {fmt(t.hst)}</div>}
                      </div>
                      <button className="btn" onClick={(e)=>{e.stopPropagation();del(t.id);}} style={{background:"none",color:"#ddd",fontSize:18,padding:"2px 4px"}}>×</button>
                    </div>
                  );})}
                </div>
              </div>
            ))}

            {/* Action buttons */}
            <div style={{margin:"8px 0 18px",display:"flex",flexDirection:"column",gap:10}}>
              {/* Primary: open live camera */}
              <button className="btn" onClick={()=>setCamera(true)} style={{width:"100%",padding:"18px",borderRadius:18,background:"linear-gradient(135deg,#E84D0E,#F97316)",color:"#fff",fontSize:14,fontWeight:600,boxShadow:"0 8px 22px rgba(232,77,14,.3)",display:"flex",alignItems:"center",justifyContent:"center",gap:10,userSelect:"none"}}>
                <span style={{fontSize:20}}>📷</span>Scan Receipt or Bill
              </button>
              {/* Secondary row: gallery + manual */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <label style={{cursor:"pointer"}}>
                  <input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);e.target.value="";}}/>
                  <div style={{padding:"12px",borderRadius:14,background:"#fff",border:"1.5px solid #E5E4E0",color:"#555",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7,boxShadow:"0 2px 8px rgba(0,0,0,.05)",userSelect:"none"}}>
                    <span style={{fontSize:15}}>🖼️</span>From Gallery
                  </div>
                </label>
                <button className="btn" onClick={()=>setManual({type:"personal",merchant:"",amount:"",hst:"",date:new Date().toISOString().slice(0,10),category:"grocery",taxTag:"none"})} style={{padding:"12px",borderRadius:14,background:"#fff",border:"1.5px solid #E5E4E0",color:"#555",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:7,boxShadow:"0 2px 8px rgba(0,0,0,.05)"}}>
                  <span style={{fontSize:15}}>✏️</span>Manual Entry
                </button>
              </div>
            </div>

            {/* Weekly card */}
            <div style={{background:"#111",color:"#fff",borderRadius:22,padding:"20px 22px",marginBottom:20,boxShadow:"0 4px 20px rgba(0,0,0,.14)"}}>
              <div style={{fontSize:10,color:"#555",fontWeight:700,letterSpacing:".09em",marginBottom:12}}>THIS WEEK</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:12}}>
                <div><div style={{fontSize:10,color:"#555",marginBottom:3}}>👤 PERSONAL</div><div style={{fontSize:17,fontWeight:600,color:"#F97316"}}>{fmt(weekP)}</div></div>
                <div><div style={{fontSize:10,color:"#555",marginBottom:3}}>💼 CORP{!hasCorp&&<span style={{fontSize:8,color:"#E84D0E",marginLeft:4}}>PRO</span>}</div><div style={{fontSize:17,fontWeight:600,color:hasCorp?"#818CF8":"#2A2A2A"}}>{hasCorp?fmt(weekC):"—"}</div></div>
              </div>
              <div style={{height:"1px",background:"rgba(255,255,255,.06)",marginBottom:12}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,color:"#555"}}>Combined total</span>
                <span style={{fontSize:14,fontWeight:600}}>{fmt(weekP+(hasCorp?weekC:0))}</span>
              </div>
            </div>
          </div>
        )}

        {/* ══ REPORTS ══ */}
        {tab==="reports"&&(
          <div style={{padding:"14px 16px 20px"}}>
            <div style={{fontSize:17,fontWeight:600,marginBottom:14,letterSpacing:'-.3px'}}>Reports</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14,background:"#ECEAE6",borderRadius:15,padding:4}}>
              {[{id:"personal",l:"👤 Personal"},{id:"corp",l:"💼 Corporation"}].map(v=>(
                <button key={v.id} className="btn" onClick={()=>{if(v.id==="corp"&&!hasCorp){setUpgrade("corp");return;}setRepV(v.id);}} style={{padding:"10px",borderRadius:12,fontSize:13,fontWeight:600,border:"none",background:repView===v.id?"#fff":"none",color:repView===v.id?"#111":"#aaa",boxShadow:repView===v.id?"0 2px 8px rgba(0,0,0,.08)":"none",position:"relative"}}>
                  {v.l}{v.id==="corp"&&!hasCorp&&<span style={{fontSize:9,background:"#E84D0E",color:"#fff",borderRadius:100,padding:"1px 5px",marginLeft:4}}>PRO</span>}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:7,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
              {[{id:"week",l:"Week"},{id:"month",l:"Month"},{id:"last",l:"Last Month"},{id:"year",l:"Year"},{id:"custom",l:"⚙️ Custom"}].map(p=>(
                <button key={p.id} className="btn" onClick={()=>setPer(p.id)} style={{padding:"7px 14px",borderRadius:100,fontSize:12,fontWeight:700,whiteSpace:"nowrap",flexShrink:0,background:period===p.id?"#111":"#fff",color:period===p.id?"#fff":"#555",border:"none",boxShadow:period===p.id?"0 2px 10px rgba(0,0,0,.18)":"0 1px 4px rgba(0,0,0,.05)"}}>{p.l}</button>
              ))}
            </div>
            {period==="custom"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
                {[{k:"s",l:"FROM"},{k:"e",l:"TO"}].map(({k,l})=>(
                  <div key={k}><div style={{fontSize:10,fontWeight:700,color:"#aaa",letterSpacing:".07em",marginBottom:5}}>{l}</div><input type="date" value={cust[k]} onChange={e=>setCust(c=>({...c,[k]:e.target.value}))} style={{width:"100%",padding:"10px 12px",border:"1.5px solid #E5E4E0",borderRadius:11,fontSize:14,fontFamily:"inherit",background:"#fff",outline:"none"}}/></div>
                ))}
              </div>
            )}

            {repView==="personal"&&(
              <>
                <div style={{background:"linear-gradient(135deg,#FFF3EE,#FFE8D6)",borderRadius:20,padding:"20px 22px",marginBottom:14,border:"1.5px solid #FFD5C2"}}>
                  <div style={{fontSize:10,color:"#B94A1A",letterSpacing:".09em",marginBottom:4}}>{pLabel.toUpperCase()} · PERSONAL</div>
                  <div style={{fontSize:20,fontWeight:700,letterSpacing:'-.2px'}}>{fmt(pTotalP)}</div>
                  <div style={{fontSize:13,color:"#B94A1A",marginTop:4}}>{inPP.length} transactions</div>
                </div>
                <div style={{background:"#fff",borderRadius:16,padding:"18px 0 8px",marginBottom:14,boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:".08em",paddingLeft:18,marginBottom:10}}>6 MONTHS</div>
                  <ResponsiveContainer width="100%" height={120}><BarChart data={bar6} barSize={24} margin={{left:0,right:14}}><XAxis dataKey="month" tick={{fill:"#ccc",fontSize:11}} axisLine={false} tickLine={false}/><YAxis hide/><Tooltip contentStyle={{background:"#111",border:"none",borderRadius:10,color:"#fff",fontSize:12}} formatter={v=>[fmt(v)]} cursor={{fill:"rgba(0,0,0,.03)"}}/><Bar dataKey="total" fill="#111" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>
                </div>
                <div style={{background:"#fff",borderRadius:16,padding:"18px",boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:".08em",marginBottom:16}}>BY CATEGORY</div>
                  {PERSONAL_CATS.map((c,i)=>{const total=inPP.filter(t=>t.category===c.id).reduce((s,t)=>s+(t.amount||0),0);const count=inPP.filter(t=>t.category===c.id).length;const pct=pTotalP>0?Math.round(total/pTotalP*100):0;return(
                    <div key={c.id} style={{marginBottom:i<PERSONAL_CATS.length-1?14:0,opacity:total===0?.3:1}}>
                      <div onClick={()=>count>0&&setDrill({catId:c.id,type:"personal"})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,cursor:count>0?"pointer":"default"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:32,height:32,borderRadius:10,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{c.icon}</div><div><div style={{fontSize:13,fontWeight:600}}>{c.label}</div>{count>0&&<div style={{fontSize:11,color:"#aaa"}}>{count} item{count!==1?"s":""}</div>}</div></div>
                        <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:600,color:total>0?"#111":"#ccc"}}>{fmt(total)}</div>{total>0&&<div style={{fontSize:11,color:"#aaa"}}>{pct}%</div>}</div>{count>0&&<span style={{fontSize:15,color:"#ddd"}}>›</span>}</div>
                      </div>
                      <div style={{height:5,background:"#F0EFEC",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.color,borderRadius:3,transition:"width .55s ease"}}/></div>
                    </div>
                  );})}
                </div>
              </>
            )}

            {repView==="corp"&&hasCorp&&(
              <>
                <div style={{background:"linear-gradient(135deg,#EEF2FF,#E0E7FF)",borderRadius:20,padding:"20px 22px",marginBottom:14,border:"1.5px solid #C7D2FE"}}>
                  <div style={{fontSize:10,color:"#4338CA",letterSpacing:".09em",marginBottom:4}}>{pLabel.toUpperCase()} · CORPORATION</div>
                  <div style={{fontSize:20,fontWeight:700,letterSpacing:'-.2px'}}>{fmt(pTotalC)}</div>
                  <div style={{display:"flex",gap:16,marginTop:8}}>
                    <div><div style={{fontSize:10,color:"#4338CA"}}>DEDUCTIBLE</div><div style={{fontSize:14,fontWeight:600,color:"#4338CA"}}>{fmt(inPC.reduce((s,t)=>{const c=ccat(t.category);return s+(t.amount||0)*(c.deduct/100);},0))}</div></div>
                    <div><div style={{fontSize:10,color:"#4338CA"}}>HST ITC</div><div style={{fontSize:14,fontWeight:600,color:"#4338CA"}}>{fmt(inPC.reduce((s,t)=>{const c=ccat(t.category);return c.hstClaimable?s+(t.hst||0):s;},0))}</div></div>
                  </div>
                </div>
                <div style={{background:"#fff",borderRadius:16,padding:"18px",boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:".08em",marginBottom:16}}>BY CATEGORY</div>
                  {CORP_CATS.map((c,i)=>{const total=inPC.filter(t=>t.category===c.id).reduce((s,t)=>s+(t.amount||0),0);const count=inPC.filter(t=>t.category===c.id).length;const pct=pTotalC>0?Math.round(total/pTotalC*100):0;return(
                    <div key={c.id} style={{marginBottom:i<CORP_CATS.length-1?14:0,opacity:total===0?.3:1}}>
                      <div onClick={()=>count>0&&setDrill({catId:c.id,type:"corp"})} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,cursor:count>0?"pointer":"default"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:32,height:32,borderRadius:10,background:`${c.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{c.icon}</div><div><div style={{fontSize:13,fontWeight:600}}>{c.label}</div><div style={{fontSize:10,color:"#aaa"}}>{c.deduct<100?`${c.deduct}% deduct.`:"100%"}{count>0?` · ${count} items`:""}</div></div></div>
                        <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:600,color:total>0?"#111":"#ccc"}}>{fmt(total)}</div>{total>0&&<div style={{fontSize:11,color:"#4338CA"}}>↩ {fmt(total*(c.deduct/100))}</div>}</div>{count>0&&<span style={{fontSize:15,color:"#ddd"}}>›</span>}</div>
                      </div>
                      <div style={{height:5,background:"#F0EFEC",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:c.color,borderRadius:3,transition:"width .55s ease"}}/></div>
                    </div>
                  );})}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ TAX ══ */}
        {tab==="tax"&&(
          <div style={{padding:"14px 16px 20px"}}>
            <div style={{fontSize:17,fontWeight:600,letterSpacing:'-.3px',marginBottom:4}}>Tax Reports</div>
            <div style={{fontSize:13,color:"#aaa",marginBottom:14}}>Canada · Ontario · {yr}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18,background:"#ECEAE6",borderRadius:15,padding:4}}>
              {[{id:"personal",l:"👤 Personal T1"},{id:"corp",l:"💼 Corp T2"}].map(v=>(
                <button key={v.id} className="btn" onClick={()=>{if(v.id==="corp"&&!hasCorp){setUpgrade("corp");return;}setTaxV(v.id);}} style={{padding:"10px",borderRadius:12,fontSize:12,fontWeight:700,border:"none",background:taxView===v.id?"#fff":"none",color:taxView===v.id?"#111":"#aaa",boxShadow:taxView===v.id?"0 2px 8px rgba(0,0,0,.08)":"none",position:"relative"}}>
                  {v.l}{v.id==="corp"&&!hasCorp&&<span style={{fontSize:9,background:"#E84D0E",color:"#fff",borderRadius:100,padding:"1px 5px",marginLeft:4}}>PRO</span>}
                </button>
              ))}
            </div>

            {taxView==="personal"&&(
              <>
                {[{label:"🏥 Medical Expenses",line:"Line 33099",total:medTotal,claimable:medClaimable,credit:medClaimable*0.15,threshold:medThreshold,type:"med"},{label:"❤️ Donations",line:"Line 34900",total:donTotal,claimable:donCredit,credit:donCredit,type:"don"},{label:"👶 Childcare",line:"Line 21400 · T778",total:chdTotal,claimable:chdTotal,credit:null,type:"chd"}].map((item,i)=>(
                  <div key={i} style={{background:"#fff",borderRadius:16,padding:"16px",marginBottom:10,boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:item.total>0&&item.type!=="chd"?10:0}}>
                      <div><div style={{fontSize:14,fontWeight:600}}>{item.label}</div><div style={{fontSize:11,color:"#E84D0E",fontWeight:700,marginTop:2}}>{item.line}</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:600,color:item.claimable>0?"#111":"#ccc"}}>{fmt(item.claimable)}</div><div style={{fontSize:10,color:"#aaa"}}>{item.type==="don"?"tax credit":"claimable"}</div></div>
                    </div>
                    {item.total>0&&item.type==="med"&&<div style={{background:"#F8F7F4",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#555",lineHeight:1.8}}><div style={{display:"flex",justifyContent:"space-between"}}><span>Total paid</span><span style={{fontWeight:700}}>{fmt(item.total)}</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span>3% threshold</span><span style={{color:"#E84D0E",fontWeight:700}}>−{fmt(item.threshold)}</span></div><div style={{borderTop:"1px solid #E8E7E3",marginTop:3,paddingTop:3,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>Claimable</span><span style={{fontWeight:700}}>{fmt(item.claimable)}</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span>Est. credit ~15%</span><span style={{color:"#16A34A",fontWeight:700}}>{fmt(item.credit)}</span></div></div>}
                    {item.total>0&&item.type==="don"&&<div style={{background:"#F8F7F4",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#555",lineHeight:1.8}}><div style={{display:"flex",justifyContent:"space-between"}}><span>First $200 @ 15%</span><span style={{fontWeight:700}}>{fmt(Math.min(item.total,200)*0.15)}</span></div>{item.total>200&&<div style={{display:"flex",justifyContent:"space-between"}}><span>Rest @ 29%</span><span style={{fontWeight:700}}>{fmt((item.total-200)*0.29)}</span></div>}<div style={{borderTop:"1px solid #E8E7E3",marginTop:3,paddingTop:3,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700}}>Total credit</span><span style={{color:"#16A34A",fontWeight:700}}>{fmt(item.credit)}</span></div></div>}
                    {item.total===0&&<div style={{fontSize:12,color:"#ccc",marginTop:6}}>No receipts tagged yet</div>}
                  </div>
                ))}
                <button className="btn" onClick={()=>{if(!isPro){setUpgrade("export");return;}const lines=[`PERSONAL TAX – ONTARIO ${yr}`,`Generated: ${new Date().toLocaleDateString("en-CA")}`,"=".repeat(50),"",`LINE 33099 MEDICAL: paid ${fmt(medTotal)}  threshold −${fmt(medThreshold)}  claimable ${fmt(medClaimable)}  credit ~${fmt(medClaimable*0.15)}`,`LINE 34900 DONATIONS: total ${fmt(donTotal)}  credit ${fmt(donCredit)}`,`LINE 21400 CHILDCARE: total ${fmt(chdTotal)}  CRA max $8,000/child`,"","─".repeat(50),"⚠️ Reference only. Consult CPA before filing."].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([lines],{type:"text/plain"}));a.download=`personal-tax-${yr}.txt`;a.click();}} style={{width:"100%",padding:"15px",borderRadius:14,background:isPro?"linear-gradient(135deg,#E84D0E,#F97316)":"#ECEAE6",color:isPro?"#fff":"#aaa",fontSize:14,fontWeight:600,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {!isPro&&"🔒 "}{isPro?"⬇ Export T1 Report":"Export T1 — Pro only"}
                </button>
              </>
            )}

            {taxView==="corp"&&hasCorp&&(
              <>
                <div style={{background:"linear-gradient(135deg,#1E1B4B,#312E81)",color:"#fff",borderRadius:20,padding:"20px 22px",marginBottom:12,boxShadow:"0 6px 24px rgba(49,46,129,.35)"}}>
                  <div style={{fontSize:10,color:"#818CF8",letterSpacing:".09em",marginBottom:8}}>T2 CORPORATION · {yr}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:12}}><div><div style={{fontSize:10,color:"#6366F1",marginBottom:3}}>GROSS</div><div style={{fontSize:19,fontWeight:600}}>{fmt(corpGrossTotal)}</div></div><div><div style={{fontSize:10,color:"#6366F1",marginBottom:3}}>DEDUCTIBLE</div><div style={{fontSize:19,fontWeight:600,color:"#A5B4FC"}}>{fmt(corpDeductTotal)}</div></div></div>
                  <div style={{height:"1px",background:"rgba(255,255,255,.08)",marginBottom:12}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><div><div style={{fontSize:10,color:"#6366F1",marginBottom:3}}>HST ITC</div><div style={{fontSize:16,fontWeight:600,color:"#34D399"}}>{fmt(corpHSTTotal)}</div></div><div><div style={{fontSize:10,color:"#6366F1",marginBottom:3}}>ON CORP RATE</div><div style={{fontSize:16,fontWeight:600}}>12.2%</div></div></div>
                </div>
                <div style={{background:"#fff",borderRadius:16,padding:"16px",marginBottom:12,boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#bbb",letterSpacing:".08em",marginBottom:12}}>HST QUARTERLY RETURN</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {qData.map((q,i)=><div key={i} style={{background:q.hst>0?"#EEF2FF":"#F8F7F4",borderRadius:10,padding:"12px"}}><div style={{fontSize:10,fontWeight:700,color:q.hst>0?"#4338CA":"#bbb",marginBottom:4}}>{q.label}</div><div style={{fontSize:14,fontWeight:600,color:q.hst>0?"#111":"#ccc"}}>{fmt(q.hst)}</div></div>)}
                  </div>
                </div>
                <button className="btn" onClick={()=>{const lines=[`CORP T2 – ONTARIO ${yr}`,`Generated: ${new Date().toLocaleDateString("en-CA")}`,"=".repeat(50),"",`GROSS: ${fmt(corpGrossTotal)}  DEDUCTIBLE: ${fmt(corpDeductTotal)}  HST ITC: ${fmt(corpHSTTotal)}`,"","QUARTERLY HST:",...qData.map(q=>`  ${q.label}: ${fmt(q.hst)}`),"","─".repeat(50),...corpBycat.map(c=>`${c.icon} ${c.label}: ${fmt(c.gross)} gross  ${fmt(c.deductible)} deduct.  ${fmt(c.hst)} HST ITC`),"","⚠️ Reference only. Have accountant review before T2 filing."].join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([lines],{type:"text/plain"}));a.download=`corp-t2-${yr}.txt`;a.click();}} style={{width:"100%",padding:"15px",borderRadius:14,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:14,fontWeight:600,marginBottom:12}}>
                  ⬇ Export Corp T2 Report
                </button>
              </>
            )}
            <div style={{padding:"12px 14px",background:"#FFF3EE",border:"1.5px solid #FFD5C2",borderRadius:12,fontSize:12,color:"#B94A1A",lineHeight:1.6}}>
              ⚠️ Reference only — consult a CPA before filing with CRA.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [state, setState] = useState("loading"); // loading | auth | app
  const [user,  setUser]  = useState(null);

  useEffect(()=>{ db.get("lt_user").then(u=>{ if(u){ setUser(u); setState("app"); } else { setState("auth"); } }); },[]);

  if(state==="loading") return <div style={{minHeight:"100vh",background:"#F5F4F0",display:"flex",alignItems:"center",justifyContent:"center"}}><LoonieIcon size={64}/></div>;

  if(state==="auth") return (
    <AuthScreen
      onGuest={()=>{ setUser({guest:true,plan:"free"}); setState("app"); }}
      onAuth={u=>{ setUser(u); setState("app"); }}
    />
  );

  return (
    <MainApp
      user={user}
      onSignOut={()=>{ setUser(null); setState("auth"); }}
      onGoAuth={()=>{ setUser(null); setState("auth"); }}
    />
  );
}