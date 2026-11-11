"""One-time story migration; retained as reproducible content tooling."""
import json,re,copy
from pathlib import Path
R=Path(__file__).parent
p=R/'data/story.json'
stories=json.loads(p.read_text())
if 'stages' in stories[0]: raise SystemExit('Already migrated')
# Add the four memoirs using the original manuscript text.
from docx import Document
d=Document('/data/AstrBot/data/temp/fileseg_莱顿逻辑馆_故事模式章节构思手记_5af05a31.docx')
specs=[('赫尔曼的阶梯教室',['alva','herman','校园'],{'同学':['阿尔瓦','赫尔曼','安娜','彼得','约翰'],'草稿':['蓝纸','白纸','黄纸','绿纸','粉纸'],'任务':['取指','译码','运算','访存','写回']}),('雨夜带你回家',['cat','alva','日常'],{'小猫':['小雪球','小橘','小黑','狸花','三花'],'软垫':['蓝垫','白垫','黄垫','绿垫','粉垫'],'毯子':['羊毛毯','绒毯','棉毯','格纹毯','条纹毯']}),('卢卡的休假午后',['luca','alva','日常'],{'物件':['耳机','万用表','轴体','模具','复盘手记'],'收纳':['蓝盒','白盒','黄盒','绿盒','粉盒'],'旁边饮品':['红茶','咖啡','白水','可可','果汁']}),('永动轮的断电之夜',['alva','herman','往事'],{'模块':['主控','通信','存储','照明','监控'],'指示灯':['蓝灯','白灯','黄灯','绿灯','紫灯'],'记录':['值班簿','维修单','检测表','交接单','验收单']})]
for (title,tags,cats),table in zip(specs,d.tables):
 vals=[r.cells[1].text for r in table.rows]
 stories.append({'title':title,'tags':tags,'intro':vals[0],'puzzle':{'id':'memo-'+str(len(stories)),'cats':cats,'s':copy.deepcopy(cats),'k':list(cats),'intro':vals[0],'end':vals[2],'frag':[{'title':'现场整理','text':'先把现场的位置关系理清，留下的记录才有了对应的人和物。'},{'title':'记录核对','text':'我把核对过的记录放在桌边，请你再看看物件之间的联系。'}],'diff':'normal'}})
for title,tags,cats,intro,end in [('赫尔曼与永动轮的秘密宴会',['herman','luca'],{'宾客':['赫尔曼','卢卡','投资者','专家','小猫'],'饰品':['银表','胸针','领夹','袖扣','丝带'],'菜肴':['羊排','慕斯','沙拉','烤鱼','甜点']},'晚宴的核心芯片被调换了。请核对餐席、饰品与菜肴。','赫尔曼指向保护电路：这是卢卡的设计。卢卡低下头，却没有再把椅子往外挪。'),('仓鼠庄园与迷宫大逃亡',['luca','cat'],{'乐园':['松果园','麦穗园','栗子园','胡桃园','葵花园'],'设施':['滚轮','滑梯','隧道','吊桥','小屋'],'补给':['燕麦','南瓜籽','小米','玉米','胡萝卜']},'五个微型乐园的标牌乱了，仓鼠们正沿着隧道找出口。先还原设施和补给的位置。','卢卡断开模型电源，收起铜丝。仓鼠首领钻回小屋，抱紧了最后一颗南瓜籽。')]:
 stories.append({'title':title,'tags':tags,'intro':intro,'puzzle':{'id':'extra-'+str(len(stories)),'cats':cats,'s':copy.deepcopy(cats),'k':list(cats),'intro':intro,'end':end,'frag':[{'title':'位置核对','text':'现场的位置关系已经清楚了，还需要把物件与主人一一对应。'}],'diff':'normal'}})
def puzzle(base,keys,id,ending):
 q=copy.deepcopy(base);q['id']=id;q['k']=keys;q['cats']={k:base['cats'][k] for k in keys};q['s']={k:base['s'][k] for k in keys}
 # A connected relational chain with one anchor uniquely determines every row.
 r=[];c=[];a=keys[0];n=len(q['s'][a]);r.append(['pos',a,q['s'][a][0],1]);c.append(f'记录确认：{q["s"][a][0]}位于第1列。')
 for j in range(n-1):
  r.append(['next',a,q['s'][a][j],a,q['s'][a][j+1]]);c.append(f'{q["s"][a][j+1]}紧挨在{q["s"][a][j]}右侧。')
 for k in keys[1:]:
  for j in range(n):
   r.append(['same',a,q['s'][a][j],k,q['s'][k][j]]);c.append(f'核对记录：{q["s"][a][j]}与{q["s"][k][j]}对应同一列。')
 q.update(r=r,c=c,q=f'第{n}列对应的{keys[-1]}是什么？',a={'position':n,'value':q['s'][keys[-1]][-1]},frag=[],end=ending)
 return q
for i,s in enumerate(stories):
 s['title']=re.sub(r'^第.+?章\s*·\s*','',s['title']);s['id']=s.get('puzzle',{}).get('id','legacy-'+str(i));s['legacyIndex']=i if i<13 else None
 if 'src' in s:
  s['stages']=[{'title':'现场推理','src':s['src'],'intro':s.get('intro',''),'ending':s.get('ending','')}];continue
 b=s['puzzle'];ks=b['k'];fr=b.get('frag',[]);count=max(2,len(fr));st=[]
 for j in range(count):
  keys=[ks[0],ks[1+j%(len(ks)-1)]]
  frag=fr[j] if j<len(fr) else {'title':'交叉核对','text':'各份记录终于相互印证。'}
  ending=frag['text'] if j<count-1 else b.get('end','')
  st.append({'title':frag['title'],'intro':b.get('intro','')+' 本阶段核对：'+'、'.join(keys)+'。所有方位按屏幕列序。','puzzle':puzzle(b,keys,s['id']+'-stage-'+str(j+1),ending)})
 s['stages']=st;s['intro']=s.get('intro',b.get('intro',''))
p.write_text(json.dumps(stories,ensure_ascii=False,indent=2))
