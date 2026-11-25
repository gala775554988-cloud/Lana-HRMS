export function classifyImportIdentity(byNationalId:string|undefined,byEmployeeNumber:string|undefined):"NEW"|"MATCH"|"CONFLICT" {
 if(!byNationalId&&!byEmployeeNumber)return "NEW";
 return byNationalId&&byNationalId===byEmployeeNumber?"MATCH":"CONFLICT";
}
