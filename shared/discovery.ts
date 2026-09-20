export type CandidateProfile = { fullName:string; location:string; targetRoles:string[]; skills:string[]; workPreference:"remote"|"hybrid"|"onsite"|"any" };
export type JobMatch = { id:string; title:string; company:string; location:string; description:string; url:string; score:number; band:"Strong match"|"Possible match"|"Low match"; reasons:string[]; source:string };
