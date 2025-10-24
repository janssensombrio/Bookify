import BookifyIcon from "../media/favorite.png";

function BookifyLogo() {
    
      const StarLogo = () => (
        <img
        src={BookifyIcon}
        alt="Bookify logo"
        className="w-9 h-9 rounded-md"
        />
      );
    
    return (
        <div className="flex items-center space-x-3">
            <StarLogo />
            <span className="text-lg font-bold text-gray-800">Bookify</span>
          </div>
    );
}

export default BookifyLogo;