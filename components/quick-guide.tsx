"use client";
import { usePreferences } from "./preferences";
import { Button, Modal } from "./ped-ui";

export function QuickGuide({ onClose }: { onClose: () => void }) {
  const { tx } = usePreferences();
  const steps = [
    [tx("申請設備箱", "Request a box"), tx("到「設備箱清單」選擇可用設備箱，按「申請」，填寫借用日期、歸還日期、站別及用途後送出。", "In Equipment box list, choose an available box and select Request. Enter the dates, fixture and purpose, then submit.")],
    [tx("工程人員簽核", "Engineering review"), tx("由 PED 工程人員或系統管理員在「PED 簽核中心」跨部門核准或駁回。自己的申請須由其他人簽核；駁回需填寫原因。", "A PED engineer or administrator approves or rejects the request in the PED approval center, across departments. Another reviewer must handle your own request. Rejection requires a reason.")],
    [tx("清點並領用", "Inspect and collect"), tx("核准後，在借用期間由工程人員或管理員按「點交借出」，逐項確認零件及數量，完成後才會列為使用中。同借用人可跨不同站別，到「產線借還管理 → 待點交借出」批量點交，每批最多 50 箱，須逐箱確認。", "After approval, an engineer or administrator selects Issue during the borrowing period and checks every component and quantity. The box is then marked as on loan. For the same borrower, including different fixtures, use Production loans → Awaiting issue to issue up to 50 boxes together, confirming each box.")],
    [tx("申請歸還", "Request return"), tx("借用人到「我的借用設備箱」按「申請歸還」，逐項確認設備、數量與狀況齊全正常，再確認箱號及站別後送出；發現異常請先聯絡工程人員或管理員。設備箱進入「待歸還驗收」，持續占用。", "In My borrowed boxes, select Request return, check every component, quantity and condition, then confirm the box and fixture. Contact engineering or an administrator about any issue before submitting. The box stays occupied while awaiting inspection.")],
    [tx("工程驗收歸還", "Inspect the returned box"), tx("由另一位工程人員或管理員實際點收、確認數量與狀況，填寫紀錄後完成歸還。缺件或損壞會轉維護／補件；尚未交回或誤送的申請可填寫原因退回。", "Another engineer or administrator verifies physical receipt, components and conditions before accepting the return. Missing or damaged parts put the box in maintenance. Decline undelivered or mistaken requests with a reason.")],
  ];
  return <Modal title={tx("簡易操作說明", "Quick start guide")} onClose={onClose}>
    <div className="dialog-body quick-guide">
      <p className="help">{tx("從申請到歸還，依照以下五步驟操作。", "Follow these five steps from request to return.")}</p>
      <ol className="guide-steps">{steps.map(([title, description], index) => <li key={index}><span className="guide-step-number" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
      <div className="guide-tip"><strong>{tx("小提醒", "Good to know")}</strong><p>{tx("設備箱已借出時，申請按鈕會反灰，歸還後才能再申請。點選申請編號可查看狀態、零件清單與簽核紀錄。", "Boxes on loan cannot be requested until returned. Select a request number to view its status, component manifest and review history.")}</p></div>
    </div>
    <footer className="dialog-footer"><Button onClick={onClose}>{tx("我知道了", "Got it")}</Button></footer>
  </Modal>;
}
