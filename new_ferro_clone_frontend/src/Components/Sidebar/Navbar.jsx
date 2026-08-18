import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

// Image imports
import user from "../../Assets/profile.png";

// Icon imports
import { BiLogOut, BiLayout } from "react-icons/bi";
import { TbLayoutGridAdd, TbCube, TbMessages, TbUsers } from "react-icons/tb";
import { LuCircleDot, LuFile, LuLayoutGrid } from "react-icons/lu";
import { PiBasket, PiLightbulbThin } from "react-icons/pi";
import { CiShoppingBasket } from "react-icons/ci";
import { HiOutlineHome } from "react-icons/hi";
import { BsBell } from "react-icons/bs";
import { GiHamburgerMenu } from "react-icons/gi";
import { RxCross1 } from "react-icons/rx";


// CSS + Components
import "./Navbar.css";
import Menu from "../Menu/Menu";

const Navbar = ({ children }) => {
  const [toggle, setToggle] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  // Simulate checking login status from localStorage
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  const handleLogin = () => {
    // Simulate login: In real app, redirect to login page
    navigate("/login");
  };

  const handleLogout = () => {
    localStorage.removeItem("token"); // Clear token/session
    setIsLoggedIn(false);
    navigate("/login");
  };

  const menuData = [
    { icon: <HiOutlineHome />, title: "Dashboard", path: "/" },
    { icon: <TbUsers />, title: "Customer", path: "/customer" },
    { icon: <CiShoppingBasket />, title: "Vendor", path: "/vendor" },
    { icon: <LuFile />, title: "Items", path: "/items" },
    { icon: <TbLayoutGridAdd />, title: "Purchase Order", path: "/purchase-order" },
    { icon: <BsBell />, title: "GRN", path: "/grn" },
    { icon: <PiLightbulbThin />, title: "BOM", path: "/bom" },
    { icon: <PiLightbulbThin />, title: "Quotation", path: "/quotation" },
    { icon: <LuCircleDot />, title: "Work Order", path: "/work-order" },
    { icon: <PiBasket />, title: "Sales", path: "/sales" },
    { icon: <BiLayout />, title: "Inventory", path: "/inventory" },
    { icon: <TbMessages />, title: "Report", path: "/report" }, 
  ];

  return (
    <>
      {/* Side Bar */}
      <div id="sidebar" className={toggle ? "hide" : ""}>
        <div className="logo">
          <div className="logoBox">
            {toggle ? (
              <GiHamburgerMenu
                className="menuIconHidden"
                onClick={() => setToggle(false)}
              />
            ) : (
              <>
                <h2 className="logoText">Welcome</h2>
                <RxCross1
                  className="menuIconHidden"
                  onClick={() => setToggle(true)}
                />
              </>
            )}
          </div>
        </div>

        {/* Sidebar Menu */}
        <ul className="side-menu top">
          {menuData.map(({ icon, title, path }, i) => (
            <Menu Icon={icon} Title={title} path={path} key={i} />
          ))}
          {isLoggedIn && (
            <Menu Icon={<BiLogOut />} Title="Logout" path="#" onClick={handleLogout} />
          )}
        </ul>
      </div>

      {/* Top Bar */}
      <div id="content">
        <nav>
          <div>
            <GiHamburgerMenu
              className="menuIcon"
              onClick={() => setToggle(!toggle)}
            />

          </div>
          <div>
            {/* <Link href="/" className="lang">
              <LiaFlagUsaSolid /> EN
            </Link>
            <Link href="/" className="navIcon">
              <CiSearch />
            </Link>
            <Link href="/" className="navIcon">
              <PiShootingStarLight />
            </Link>
            <Link href="/" className="navIcon">
              <PiLightbulbThin />
            </Link>
            <Link href="/" className="cart">
              <CiShoppingBasket />
              <span className="numCart number">2</span>
            </Link>
            <Link href="/" className="notification">
              <BsBell />
              <span className="num number">4</span>
            </Link> */}

            {/* <div> */}
            {!isLoggedIn ? (
              <button className="login-button" onClick={handleLogin}>
                Login
              </button>
            ) : (
              <div className="profile">
                <img src={user} alt="Profile" />
                <button className="logout-button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>
        {children}
      </div>
    </>
  );
};

export default Navbar;
