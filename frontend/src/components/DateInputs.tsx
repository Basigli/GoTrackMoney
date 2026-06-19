import { forwardRef } from 'react';

export const HeaderDateInput = forwardRef(({ value, onClick, extraText }: any, ref: any) => (
  <div className="date-display" onClick={onClick} ref={ref} style={{ cursor: 'pointer' }}>
    <span className="date-icon">📅</span>
    <div className="date-text">
      <h2>{value}</h2>
      {extraText && <p>{extraText}</p>}
    </div>
  </div>
));
HeaderDateInput.displayName = 'HeaderDateInput';

export const ModalDateInput = forwardRef(({ value, onClick, labelText }: any, ref: any) => (
  <div className="modal-header" onClick={onClick} ref={ref} style={{ cursor: 'pointer' }}>
    <span className="date-icon">📅</span>
    <div className="date-text">
      <h2>{labelText || 'Date & Time'}</h2>
      <p>{value}</p>
    </div>
  </div>
));
ModalDateInput.displayName = 'ModalDateInput';
