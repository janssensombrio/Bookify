import './styles/nav.css'; 

function Navigation({ onOpenHostModal }) {
    return (
        <nav>
            <div className="left-header">
                <h1>Bookify</h1>
            </div>

            <div className="categories-wrapper">
                <button>Homes</button>
                <button>Experiences</button>
                <button>Services</button>
            </div>

            <div className="right-header">
                {/* Trigger modal */}
                <button onClick={onOpenHostModal}>Become a host</button>
                <button>Menu</button>
            </div>
        </nav>
    );
}

export default Navigation;
