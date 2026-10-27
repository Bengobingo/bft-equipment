"use client";
import { usePreferences } from "./preferences";
import { Button, Modal } from "./ped-ui";

export function QuickGuide({ onClose }: { onClose: () => void }) {
  const { tx } = usePreferences();
  const steps = [
    [tx("申請設備箱", "Request a box"), tx("到「設備箱清單」選擇可用設備箱，按「申請」，填寫借用日期、歸還日期、站別及用途後送出。", "In Equipment box list, choose an available box and select Request. Enter the dates, fixture and purpose, then submit.")],
    [tx("工程人員簽核", "Engineering review"), tx("由 PED 工程人員或系統管理員在「PED 簽核中心」跨部門核准或駁回。自己的申請須由其他人簽核；駁回需填寫原因。", "A PED engineer or administrator approves or rejects the request in the PED approval center, across departments. Another reviewer must handle your own request. Rejection requires a reason.")],
    [tx("清點並領用", "Inspect and collect"), tx("核准後，在借用期間由工程人員或管理員按「點交借出」，逐項確認零件及數量，完成後才會列為使用中。", "After approval, an engineer or administrator selects Issue during the borrowing period and checks every component and quantity. The box is then marked as on loan.")],
    [tx("歸還設備箱", "Return the box"), tx("到「我的借用設備箱」按「歸還清點」，勾選零件、確認實還數量與狀況，填寫檢查紀錄後確認歸還。缺件或損壞會轉為待維護／補件。", "In My borrowed boxes, select Return. Check each component, enter returned quantities and conditions, add an inspection note and confirm. Missing or damaged parts put the box into maintenance.")],
  ];
  return <Modal title={tx("簡易操作說明", "Quick start guide")} onClose={onClose}>
    <div className="dialog-body quick-guide">
      <p className="help">{tx("從申請到歸還，依照以下四步驟操作。", "Follow these four steps from request to return.")}</p>
      <ol className="guide-steps">{steps.map(([title, description], index) => <li key={index}><span className="guide-step-number" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
      <div className="guide-tip"><strong>{tx("小提醒", "Good to know")}</strong><p>{tx("設備箱已借出時，申請按鈕會反灰，歸還後才能再申請。點選申請編號可查看狀態、零件清單與簽核紀錄。", "Boxes on loan cannot be requested until returned. Select a request number to view its status, component manifest and review history.")}</p></div>
    </div>
    <footer className="dialog-footer"><Button onClick={onClose}>{tx("我知道了", "Got it")}</Button></footer>
  </Modal>;
}
