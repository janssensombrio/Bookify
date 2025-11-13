import BookifyIcon from "../media/favorite.png";

function BookifyLogo() {
    return (
        <div className="flex items-center space-x-3">
            <img
                src={BookifyIcon}
                alt="Bookify logo"
                className="w-9 h-9 rounded-md"
            />
            <span className="text-lg font-bold text-gray-800">Bookify</span>
        </div>
    );
}

export default BookifyLogo;