(function(root, factory) {
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.BuyunluCommerce=factory();
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function install(page,{host,boards,storage}) {
    const account=host.BuyunluCardAccount, api=host.BuyunluAPI.request;
    if(boards){
      let boardRequest=0;
      let scoreUpload;
      const signedOwner=()=>account.user?.emailVerified?account.user.id:null;
      const submit=boards.submit;
      boards.isConfigured=()=>!!signedOwner();
      boards.submit=async function(state){
        const owner=signedOwner();
        if(!owner)throw new Error('请先登录并验证邮箱后同步成绩');
        if(!state?.ended)throw new Error('产生结局后才会上传成绩');
        if(state._webLeaderboardOwner&&state._webLeaderboardOwner!==owner)throw new Error('本局成绩属于其他账号，请切回原账号同步');
        state._webLeaderboardOwner=owner;
        if(storage&&!storage.save(state)){
          host.wx.showToast({title:'成绩同步失败，请先释放本机存储空间再重试',icon:'none'});
          throw new Error('结局存档未能保存');
        }
        return submit(state,(route,{data})=>{
          const body={...data,accountId:owner};delete body.clientId;
          const key=JSON.stringify(body);
          if(scoreUpload?.owner===owner&&scoreUpload.key===key)return scoreUpload.promise;
          const job={owner,key};scoreUpload=job;
          job.promise=Promise.resolve().then(()=>api(route,body)).then(result=>{
            if(signedOwner()!==owner)throw new Error('登录账号已变化，请重新打开排行榜');
            host.wx.showToast({title:'成绩已同步至全网榜单',icon:'success'});
            return result;
          }).catch(cause=>{
            if(scoreUpload===job)scoreUpload=null;
            if(signedOwner()===owner)host.wx.showToast({title:'成绩同步失败，联网后重新打开排行榜可重试',icon:'none'});
            throw cause;
          });
          return job.promise;
        });
      };
      for(const [method,path,title,format] of [
        ['showLeaderboard','leaderboard','步步有为 · 人生排行榜',boards.rankingRows],
        ['showTigerBoard','tigerboard','步步有为 · 老虎榜',boards.tigerRows],
        ['showEscapeBoard','escapeboard','金蝉榜 · 虚构结局记录',boards.escapeRows],
      ])page[method]=async function(){
        const sequence=++boardRequest,ending=method==='showLeaderboard'&&!!this.data.state.ended;
        const owner=signedOwner();
        const show=rows=>this.showModal({title,rows,content:'',showCancel:ending,confirmText:ending?'再试一次':'确定',cancelText:'关闭',
          success:result=>{if(ending&&result.confirm)this.startFreshGame();}});
        show([{kind:'note',text:'正在读取原排行榜…'}]);
        try{
          let syncError;
          if(owner&&this.data.state.ended)try{await boards.submit(this.data.state);}catch(cause){syncError=cause;}
          if(sequence!==boardRequest||!this.data.dialog.visible||this.data.dialog.title!==title)return;
          if(signedOwner()!==owner){show([{kind:'note',text:'登录账号已变化，请重新打开排行榜。'}]);return;}
          const result=await api((owner?'/':'/public/')+path+'?limit=8');
          if(sequence!==boardRequest||!this.data.dialog.visible||this.data.dialog.title!==title)return;
          if(signedOwner()!==owner){show([{kind:'note',text:'登录账号已变化，请重新打开排行榜。'}]);return;}
          const rows=format(result).map(row=>row.text==='本设备尚未提交结局成绩'?{...row,text:owner?'本账号尚未提交结局成绩':'与原小程序共用排行榜数据'}:owner&&row.player?{...row,name:row.name.replace('（本设备）','（本账号）')}:row);
          if(syncError)rows.unshift({kind:'note',text:this.data.state._webLeaderboardOwner!==owner?'本局成绩属于其他账号，尚未同步；请切回原账号重试。':'本局成绩尚未同步，联网后重新打开排行榜可重试。'});
          show(rows);
        }catch{
          if(sequence===boardRequest&&this.data.dialog.visible&&this.data.dialog.title===title)show([{kind:'note',text:'排行榜暂时连接失败，请稍后重试。'}]);
        }
      };
    }
    let record={request:null,applied:[]};
    const setPay=page.setPay;
    page.setPay=function(value){setPay.call(this,value);this.setData({'pay.priceText':'¥0.10/张','pay.buyLabel':account.user?.emailVerified?'购买':'登录购买'});};
    const recordKey=()=>account.user?'buyunlu_paid_card_use:'+account.user.id:null;
    const save=()=>{const key=recordKey();if(key)host.localStorage.setItem(key,JSON.stringify(record));};
    const restore=()=>{
      try { const value=JSON.parse(host.localStorage.getItem(recordKey())||'null');record=value&&Array.isArray(value.applied)?value:{request:null,applied:[]}; }
      catch {record={request:null,applied:[]};}
    };
    page.cardBalance=function(){return Number.isSafeInteger(this._payRaw?.balance)&&this._payRaw.balance>0?this._payRaw.balance:0;};
    page.refreshPayBalance=async function(){
      await account.ready;
      try{await account.restore?.();}catch{return {ok:false};}
      if(!account.user?.emailVerified){this.setPay({balance:0});return {ok:false};}
      const owner=account.user.id;
      try{const result=await api('/pay/balance');if(account.user?.id===owner)this.setPay({balance:result.balance});return result;}
      catch(cause){if(cause.status===401&&account.user?.id===owner){this.setPay({balance:0});try{await account.restore?.();}catch{}}return {ok:false};}
    };
    page.refreshPay=async function(){
      await account.ready;
      this.setPay({enabled:true,buying:false,name:'广告卡',balance:0,cardsPerUnit:10,priceYuan:1,reason:''});
      this.setData({'pay.priceText':'¥0.10/张','pay.buyLabel':account.user?.emailVerified?'购买':'登录购买'});
      return this.refreshPayBalance();
    };
    page.buyAdCard=page.chooseAdCardAmount=page.showCustomAdCardAmount=function(){account.checkout();};
    page.showAdCard=function(){
      if(record.request)return this.showModal({title:'确认上次用卡',content:record.request.scene==='load'?'上次读档尚未完成。重试将读取之前选择的存档，不会重复扣卡。':'上次用卡结果未确认，请在晋升条件中重试。重复请求不会重复扣卡。',showCancel:record.request.scene==='load',confirmText:record.request.scene==='load'?'重试确认':'确定',success:answer=>{if(answer.confirm&&record.request?.scene==='load')this.useLoadAdCard(record.request.slot);}});
      return account.checkout();
    };
    function promotionBlocked(){
      const state=page.data.state;
      if(state.ended||state.rankIndex>=11)return '当前无需晋升加成，未扣卡';
      if(state.promotionAdWatchCount>=33)return '本局各职级晋升概率已达100%，无需再用卡，未扣卡';
      return '';
    }
    page.consumeAdCard=async function(options={}){
      if(this._payBusy||typeof options.reward!=='function')return;
      if(!['promotion','load'].includes(options.scene))return host.wx.showToast({title:'广告卡仅用于晋升加成或读取存档'});
      const owner=account.user?.id;
      this._payBusy=true;
      try{
        try{await account.ready;await account.restore?.();}
        catch{return host.wx.showToast({title:'账号服务暂时连接失败，未提交扣卡，请重试'});}
        if(account.user?.id!==owner)return host.wx.showToast({title:'登录账号已变化，请核对账号后重试，未扣卡'});
        if(!account.user?.emailVerified)return account.open();
        const state=this.data.state;
        if(options.scene==='promotion'&&!record.request&&promotionBlocked())return host.wx.showToast({title:promotionBlocked()});
        if(record.request&&(record.request.scene||'promotion')!==options.scene)return this.showAdCard();
        if(!record.request)record.request=options.scene==='load'?{requestId:host.crypto.randomUUID(),scene:'load',slot:options.slot,snapshot:options.snapshot}:
          {requestId:host.crypto.randomUUID(),scene:'promotion',bonusScope:'career',year:state.year,rankIndex:state.rankIndex,before:state.promotionAdWatchCount||0};
        const request=record.request;
        if(options.scene==='promotion'&&(request.year!==state.year||request.rankIndex!==state.rankIndex))return host.wx.showToast({title:'请先恢复上次用卡时的游戏进度'});
        try{save();}catch{return host.wx.showToast({title:'本机存储不可用，未提交扣卡'});}
        try{
          const result=await api('/pay/consume',{scene:options.scene,requestId:request.requestId,accountId:owner});
          if(account.user?.id!==owner)return;
          this.setPay({balance:result.balance});
          const current=this.data.state;
          const alreadyApplied=options.scene==='load'?current._paidLoadRequest===request.requestId:
            (request.bonusScope==='career'||current.promotionAdUsedYear===request.year)&&current.promotionAdWatchCount>request.before;
          if(!record.applied.includes(request.requestId)&&!alreadyApplied){options.reward(request);}
          if(options.scene==='promotion'&&storage&&!storage.save(this.data.state))throw new Error('生涯加成尚未保存，请释放本机存储后重试，不会重复扣卡');
          record.applied=[...record.applied.slice(-99),request.requestId];record.request=null;save();
        }catch(cause){
          if(account.user?.id!==owner)return;
          if(/余额不足/.test(cause.message)){record.request=null;this.setPay({balance:0});try{save();}catch{}}
          if(cause.status===409&&/账号已变化/.test(cause.message)){try{await account.restore?.();}catch{}}
          host.wx.showToast({title:cause.message||'用卡结果未确认，请重试'});
        }
      }finally{this._payBusy=false;}
    };
    page.playRewardedVideo=function(options={}){
      if(options.scene==='promotion')return this.consumeAdCard(options);
      if(options.scene==='load')return this.load();
      host.wx.showToast({title:'网页版不播放微信激励广告，未发放奖励'});
    };
    const showActions=page.showActionSheet;
    page.showActionSheet=function(options,extra){
      const next={...options};
      if(next.title==='完整晋升路线'&&Array.isArray(next.itemList)){
        const balance=this.cardBalance(),blocked=promotionBlocked(),pending=record.request&&(record.request.scene||'promotion')==='promotion';
        const entries=next.itemList.map((label,index)=>({label,index})).filter(item=>!/^(用免广告卡|看广告|免费领取|使用广告卡).*晋升/.test(item.label));
        if(!blocked||pending)entries.push({label:pending?'确认上次用卡（不重复扣卡）':balance>0?'使用1张广告卡（余额'+balance+'张）':account.user?.emailVerified?'购买广告卡':'登录购买广告卡',card:true});
        next.tone='promotion';next.itemList=entries.map(item=>item.label);
        next.content=String(next.content||'').replace(this.data.adText||'','').replace(/^满足资历[^\n]*\n/,'').trim()+'\n\n本局生涯加成：+'+(this.data.state.promotionAdWatchCount||0)*3+'个百分点。跨年、晋升保留，重开清零。\n广告卡余额：'+balance+'张。'+(blocked?blocked.replace('，未扣卡','')+'。':'每张+3个百分点，最终概率最高100%，仍需满足晋升条件。');
        next.success=result=>{
          const entry=entries[result.tapIndex];if(!entry)return;
          if(entry.card)return pending||this.cardBalance()>0?this.usePromotionAdCard():account.checkout();
          return options.success?.({...result,tapIndex:entry.index});
        };
      }else if(Array.isArray(next.itemList))next.itemList=next.itemList.map(text=>text==='免费领取晋升概率+3%'||text==='看广告，晋升概率+3%'?'使用广告卡，晋升概率+3%':text);
      return showActions.call(this,next,extra);
    };
    const patch=page.buildPatch;
    page.buildPatch=function(...args){const result=patch.apply(this,args);const state=result.state||this.data.state;result.adText='本局生涯晋升加成：+'+(state.promotionAdWatchCount||0)*3+'个百分点。每张广告卡+3个百分点，跨年、晋升保留，重新开局清零；最终概率最高100%，仍需满足晋升条件。也可用1张卡读取本机存档。';return result;};
    for(const method of ['startFreshGame','startQuarter','tryPromotion']){
      const original=page[method];
      page[method]=function(...args){if(record.request||this._payBusy)return this.showAdCard();return original.apply(this,args);};
    }
    if(storage){
      page.useLoadAdCard=function(slot){
        if(this._payBusy)return;
        if(record.request&&(record.request.scene!=='load'||record.request.slot!==slot))return this.showAdCard();
        const snapshot=record.request?.snapshot||storage.loadSlot(slot);
        if(!snapshot||typeof snapshot!=='object'||!Number.isFinite(snapshot.age)||!Number.isFinite(snapshot.year))return host.wx.showToast({title:'存档为空或损坏，未扣卡'});
        return this.consumeAdCard({scene:'load',slot,snapshot,reward:request=>{
          // The receipt is stored with the game state in one write. A retry after a
          // crash cannot reset progress again or turn a saved slot into free cards.
          const persisted=storage.load();
          const loaded=persisted?._paidLoadRequest===request.requestId?persisted:{...request.snapshot,_paidLoadRequest:request.requestId};
          if(!storage.save(loaded))throw new Error('读档尚未完成，请释放本机存储后重试，不会重复扣卡');
          host.wx.removeStorageSync('buyunlu_mobile_pending_v1');
          this._burstEvent=null;this._burstKind='normal';this._burstReview=false;
          this.setData({state:loaded,currentEvent:null,burst:{visible:false,review:false,flag:'',tag:'',title:'',scene:'',tip:'',options:[]}},()=>this.refresh());
          host.wx.showToast({title:'已读取存档'+request.slot+'，消耗1张广告卡'});
        }});
      };
      page.applyLoadedSlot=function(slot){return this.useLoadAdCard(slot);};
      page.load=function(){
        if(record.request||this._payBusy)return this.showAdCard();
        const slots=storage.slotList();
        this.showActionSheet({title:'读取本机存档',content:'成功读档消耗 1 张广告卡，替换当前游戏进度。取消或空存档不扣卡。',
          itemList:slots.map(slot=>slot.empty?'存档'+slot.slot+' · 空':'存档'+slot.slot+' · '+slot.name+' · '+slot.year+'年'),cancelText:'返回',success:result=>{
            const slot=slots[result.tapIndex];if(!slot||slot.empty)return host.wx.showToast({title:'该存档为空，未扣卡'});
            this.showModal({title:'读取存档'+slot.slot,content:'读取'+slot.name+'在'+slot.year+'年的进度，将替换当前进度。需消耗 1 张广告卡，余额以服务器确认为准。',confirmText:'用1张卡读档',cancelText:'取消',success:answer=>{if(answer.confirm)this.useLoadAdCard(slot.slot);}});
          }});
      };
    }
    const selectNav=page.selectNav;
    page.selectNav=function(...args){selectNav.apply(this,args);if(this.data.dialog?.visible)this.setData({'dialog.content':this.data.dialog.content.replace(/离线版可免费领取晋升加成。/g,'广告卡购买和使用需联网确认。')});};
    account.onChange=()=>{restore();page.refreshPay();};
    account.canChange=()=>!record.request&&!page._payBusy;
    account.ready.then(()=>{restore();page.refreshPay();});
    const onShow=page.onShow;
    page.onShow=function(){onShow?.call(this);this.refreshPayBalance();};
  }
  return {install};
});
