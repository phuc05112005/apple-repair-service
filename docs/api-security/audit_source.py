import json, hashlib, pathlib, re, xml.etree.ElementTree as ET
root=pathlib.Path.cwd()
out=root/"docs/api-security"
def read(path): return json.loads(path.read_text(encoding="utf-8-sig"))
old={x["path"]:x["sha256"].upper() for x in read(out/"service-phase-baseline.json")["files"]}
start={x["path"]:x["sha256"].upper() for x in read(out/"continuation-source-baseline.json")}
files={p.relative_to(root).as_posix():p for p in (root/"src").rglob("*.java")}
def differences(baseline):
    return {"added":[p for p in files if p not in baseline],
            "modified":[p for p in files if p in baseline and hashlib.sha256(files[p].read_bytes()).hexdigest().upper()!=baseline[p]],
            "missing":[p for p in baseline if p not in files]}
phase=differences(old); continuation=differences(start)
protected=[p for p in phase["modified"]+phase["missing"] if "/entity/" in p or "/enums/" in p or p.startswith("src/test/")]
controllers=[p for p in files if "@RestController\n" in files[p].read_text(encoding="utf-8-sig")]
unsafe=[]
for p in controllers:
    text=files[p].read_text(encoding="utf-8-sig")
    if re.search(r"import .*\.(repository|entity)\.",text): unsafe.append(p)
test_files=[]
for p in (root/"target/surefire-reports").glob("TEST-*.xml"):
    r=ET.parse(p).getroot()
    test_files.append({"class":r.attrib["name"],**{key:int(r.attrib[key]) for key in ["tests","failures","errors","skipped"]},
                       "scenarios":[x.attrib["name"] for x in r.findall("testcase")]})
result={"phase":phase,"continuation":continuation,"protectedChanges":protected,
        "controllerCount":len(controllers),"controllers":controllers,
        "dtoAddedPhase":[p for p in phase["added"] if "/dto/" in p],
        "serviceAddedPhase":[p for p in phase["added"] if "/service/" in p and p.startswith("src/main/")],
        "serviceModifiedPhase":[p for p in phase["modified"] if "/service/" in p and p.startswith("src/main/")],
        "repositoryAddedPhase":[p for p in phase["added"] if "/repository/" in p],
        "repositoryModifiedPhase":[p for p in phase["modified"] if "/repository/" in p],
        "controllerArchitectureViolations":unsafe,"tests":test_files}
(out/"source-test-audit.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"controllers":len(controllers),"dtoAddedPhase":len(result["dtoAddedPhase"]),"serviceAddedPhase":len(result["serviceAddedPhase"]),
"serviceModifiedPhase":len(result["serviceModifiedPhase"]),"repositoryModifiedPhase":len(result["repositoryModifiedPhase"]),"protectedChanges":protected,
"controllerArchitectureViolations":unsafe,"continuationChanges":continuation},indent=2))

