import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Menu.css";

const Menu = ({ Icon, Title, path }) => {
  const location = useLocation();

  const isActive =
    path === "/"
      ? location.pathname === "/" 
      : location.pathname.startsWith(path); 

  return (
    <li className={isActive ? "active" : ""}>
      <Link to={path} className={Title === "Logout" ? "logout" : ""}>
        {Icon}
        <span className="text">{Title}</span>
      </Link>
    </li>
  );
};

export default Menu;
