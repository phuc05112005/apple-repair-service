from pathlib import Path
import json,re,hashlib,urllib.request,urllib.error,datetime,subprocess
root=Path.cwd();base=root/"src/main/java/com/applecare/apple_repair_service";out=root/"docs/frontend-audit";out.mkdir(parents=True,exist_ok=True)
sources={}
for folder in ["controller","dto","enums","security","config"]:
    for p in (base/folder).rglob("*.java"):
        sources[p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
protected={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/"src").rglob("*") if p.is_file()}
protected["pom.xml"]=hashlib.sha256((root/"pom.xml").read_bytes()).hexdigest()
inventory=json.loads((root/"docs/api-security/endpoint-inventory.json").read_text(encoding="utf-8-sig"))
source_pairs=set()
for p in (base/"controller").glob("*.java"):
    text=p.read_text(encoding="utf-8-sig")
    prefix=re.search(r'@RequestMapping\("([^"]+)"\)',text)
    if not prefix: continue
    for m in re.finditer(r'@(Get|Post|Put|Delete|Patch)Mapping(?:\("([^"]*)"\))?',text):
        source_pairs.add((m.group(1).upper(),prefix.group(1)+(m.group(2) or "")))
snapshot=json.loads((root/"docs/api-security/openapi.json").read_text(encoding="utf-8-sig"))
def pairs(doc):
    return {(method.upper(),path) for path,item in doc.get("paths",{}).items() for method in item if method in ["get","post","put","delete","patch"] and path.startswith("/api/v1/")}
assert source_pairs=={(e["method"],e["path"]) for e in inventory}==pairs(snapshot)
probes=[]
live=None
for path in ["/v3/api-docs","/swagger-ui/index.html"]:
    try:
        with urllib.request.urlopen("http://localhost:8080"+path,timeout=5) as response:
            payload=response.read()
            probes.append({"path":path,"status":response.status,"bytes":len(payload),"contentType":response.headers.get("Content-Type")})
            if path=="/v3/api-docs":
                live=json.loads(payload)
                (out/"live-openapi.json").write_text(json.dumps(live,ensure_ascii=False,indent=2),encoding="utf-8")
    except urllib.error.HTTPError as e: probes.append({"path":path,"status":e.code})
    except (urllib.error.URLError,TimeoutError) as e: probes.append({"path":path,"status":None,"error":str(e.reason if hasattr(e,"reason") else e)})
enums={}
for p in (base/"enums").glob("*.java"):
    enums[p.stem]=[s.strip() for s in p.read_text().split("{",1)[1].split("}",1)[0].strip().split(",")]
result={"timestamp":datetime.datetime.now(datetime.timezone.utc).isoformat(),"gitBranch":subprocess.check_output(["git","-c",f"safe.directory={root.as_posix()}","branch","--show-current"],text=True).strip(),
"gitCommit":subprocess.check_output(["git","-c",f"safe.directory={root.as_posix()}","rev-parse","--short","HEAD"],text=True).strip(),
"controllerCount":len([p for p in (base/"controller").glob("*.java") if re.search(r"@RestController\s",p.read_text(encoding="utf-8-sig"))]),
"dtoCount":len(list((base/"dto").rglob("*.java"))),"enumCount":len(enums),"endpointCount":len(source_pairs),
"sourceSnapshotInventoryMatch":True,"runtimeProbes":probes,"liveEndpointCount":len(pairs(live)) if live else None,
"liveSourceEndpointMatch":pairs(live)==source_pairs if live else None,"filesRead":list(sources),"sourceHashes":protected,"enums":enums}
(out/"audit-evidence.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({k:v for k,v in result.items() if k not in ["filesRead","sourceHashes","enums"]},ensure_ascii=False,indent=2))

