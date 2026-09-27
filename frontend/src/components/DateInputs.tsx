import { forwardRef } from 'react';

type ModalDateInputProps = {
  value?: string;
  onClick?: () => void;
  labelText?: string;
};

export const ModalDateInput = forwardRef<HTMLDivElement, ModalDateInputProps>(({ value, onClick, labelText }, ref) => (
  <div className="modal-header" onClick={onClick} ref={ref} style={{ cursor: 'pointer' }}>
    <span className="date-icon">📅</span>
    <div className="date-text">
      <h2>{labelText || 'Date & Time'}</h2>
      <p>{value}</p>
    </div>
  </div>
));
ModalDateInput.displayName = 'ModalDateInput';
