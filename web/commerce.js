(function(root, factory) {
  if(typeof module==='object'&&module.exports) module.exports=factory();
  else root.BuyunluCommerce=factory();
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function install(page,{host,boards}) {
    const account=host.BuyunluCardAccount, api=host.BuyunluAPI.request;
    if(boards){
      let boardRequest=0;
      for(const [method,path,title,format] of [
        ['showLeaderboard','leaderboard','步云录 · 人生排行榜',boards.rankingRows],
        ['showTigerBoard','tigerboard','步云录 · 老虎榜',boards.tigerRows],
        ['showEscapeBoard','escapeboard','金蝉榜 · 虚构结局记录',boards.escapeRows],
      ])page[method]=async function(){
        const sequence=++boardRequest,ending=method==='showLeaderboard'&&!!this.data.state.ended;
        const show=rows=>this.showModal({title,rows,content:'',showCancel:ending,confirmText:ending?'再试一次':'确定',cancelText:'关闭',
          success:result=>{if(ending&&result.confirm)this.startFreshGame();}});
        show([{kind:'note',text:'正在读取原排行榜…'}]);
        try{
          const result=await api('/public/'+path+'?limit=8');
          if(sequence!==boardRequest||!this.data.dialog.visible||this.data.dialog.title!==title)return;
          show(format(result).map(row=>row.text==='本设备尚未提交结局成绩'?{...row,text:'与原小程序共用排行榜数据'}:row));
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
      if(!account.user?.emailVerified){this.setPay({balance:0});return {ok:false};}
      const owner=account.user.id;
      try{const result=await api('/pay/balance');if(account.user?.id===owner)this.setPay({balance:result.balance});return result;}
      catch(cause){if(account.user?.id===owner)this.setPay({balance:0});return {ok:false};}
    };
    page.refreshPay=async function(){
      await account.ready;
      this.setPay({enabled:true,buying:false,name:'广告卡',balance:0,cardsPerUnit:10,priceYuan:1,reason:''});
      this.setData({'pay.priceText':'¥0.10/张','pay.buyLabel':account.user?.emailVerified?'购买':'登录购买'});
      return this.refreshPayBalance();
    };
    page.buyAdCard=page.chooseAdCardAmount=page.showCustomAdCardAmount=function(){account.checkout();};
    page.showAdCard=function(){
      if(record.request)return this.showModal({title:'确认上次用卡',content:'上次用卡结果未确认，请在晋升条件中重试。重复请求不会重复扣卡。',showCancel:false});
      return account.checkout();
    };
    page.consumeAdCard=async function(options={}){
      if(this._payBusy||typeof options.reward!=='function')return;
      if(options.scene!=='promotion')return host.wx.showToast({title:'网页版广告卡用于晋升加成，其他激励广告暂不支持'});
      if(!account.user?.emailVerified)return account.open();
      const owner=account.user.id;
      const state=this.data.state;
      if(state.ended||state.rankIndex>=11)return host.wx.showToast({title:'当前无需晋升加成，未扣卡'});
      if(!record.request)record.request={requestId:host.crypto.randomUUID(),year:state.year,rankIndex:state.rankIndex,
        before:state.promotionAdUsedYear===state.year?state.promotionAdWatchCount:0};
      const request=record.request;
      if(request.year!==state.year||request.rankIndex!==state.rankIndex)return host.wx.showToast({title:'请先恢复上次用卡时的游戏进度'});
      try{save();}catch{return host.wx.showToast({title:'本机存储不可用，未提交扣卡'});}
      this._payBusy=true;
      try{
        const result=await api('/pay/consume',{scene:'promotion',requestId:request.requestId});
        if(account.user?.id!==owner)return;
        this.setPay({balance:result.balance});
        const current=this.data.state;
        const alreadyApplied=current.promotionAdUsedYear===request.year&&current.promotionAdWatchCount>request.before;
        if(!record.applied.includes(request.requestId)&&!alreadyApplied){options.reward();}
        record.applied=[...record.applied.slice(-99),request.requestId];record.request=null;save();
      }catch(cause){
        if(account.user?.id!==owner)return;
        if(/余额不足/.test(cause.message)){record.request=null;this.setPay({balance:0});try{save();}catch{}}
        host.wx.showToast({title:cause.message||'用卡结果未确认，请重试'});
      }finally{this._payBusy=false;}
    };
    page.playRewardedVideo=function(options={}){
      if(options.scene==='promotion')return this.consumeAdCard(options);
      host.wx.showToast({title:'网页版不播放微信激励广告，未发放奖励'});
    };
    const showActions=page.showActionSheet;
    page.showActionSheet=function(options,extra){
      const next={...options};
      if(Array.isArray(next.itemList))next.itemList=next.itemList.map(text=>text==='免费领取晋升概率+3%'||text==='看广告，晋升概率+3%'?'使用广告卡，晋升概率+3%':text);
      return showActions.call(this,next,extra);
    };
    const patch=page.buildPatch;
    page.buildPatch=function(...args){const result=patch.apply(this,args);result.adText='广告卡每张0.1元，最低1元购买10张；每张晋升概率增加3个百分点，不保证成功。付费卡余额按购卡账号保存。';return result;};
    for(const method of ['startFreshGame','applyLoadedSlot','startQuarter']){
      const original=page[method];
      page[method]=function(...args){if(record.request||this._payBusy)return this.showAdCard();return original.apply(this,args);};
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
