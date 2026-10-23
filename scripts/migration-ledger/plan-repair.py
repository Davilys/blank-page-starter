#!/usr/bin/env python3
"""Read `supabase migration list` text and emit a review-only repair plan. Never mutates."""
import re,sys,json,pathlib
text=pathlib.Path(sys.argv[1]).read_text(); rows=[]
for line in text.splitlines():
 p=line.replace('`','').split('|')
 if len(p)>=2:
  a,b=p[0].strip(),p[1].strip()
  if re.fullmatch(r'\d{14}',a) or re.fullmatch(r'\d{14}',b):rows.append((a if re.fullmatch(r'\d{14}',a) else '',b if re.fullmatch(r'\d{14}',b) else ''))
local={a for a,b in rows if a};remote={b for a,b in rows if b}; lp=local-remote;rp=remote-local;pairs=[]
for r in sorted(rp):
 c=sorted((abs(int(r)-int(l)),l) for l in lp if l[:8]==r[:8])
 if c and c[0][0]<=10:pairs.append({'remote':r,'local':c[0][1],'delta_seconds':c[0][0]})
paired={x['local'] for x in pairs}; out={'counts':{'local':len(local),'remote':len(remote),'matched':len(local&remote),'local_only':len(lp),'remote_only':len(rp)},'near_timestamp_pairs':pairs,'remote_only_unpaired':sorted(rp-{x['remote'] for x in pairs}),'local_only_unpaired':sorted(lp-paired)}
print(json.dumps(out,indent=2))
