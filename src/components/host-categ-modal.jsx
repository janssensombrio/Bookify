import './styles/host-categ-modal.css';

function HostCategModal({ onClose, onSelectCategory }) {
  return (
    <div className="select-categ-modal">
      <div className="modal-header">
        <h4>What would you like to host?</h4>
        <button onClick={onClose}>Close</button>
      </div>
      <div className="categ-cards">
        <button onClick={() => onSelectCategory('Homes')}>Homes</button>
        <button onClick={() => onSelectCategory('Experiences')}>Experiences</button>
        <button onClick={() => onSelectCategory('Services')}>Services</button>
      </div>
    </div>
  );
}


export default HostCategModal;
