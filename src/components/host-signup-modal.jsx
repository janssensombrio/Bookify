import './styles/host-signup-modal.css';

function HostSignUpModal({ category, onClose }) {
  return (
    <div className="signup-modal">
      <div className="modal-header">
        <h4>Sign up as a host for {category}</h4>
        <button onClick={onClose}>Close</button>
      </div>
      {/* Add sign-up form here */}
    </div>
  );
}

export default HostSignUpModal;