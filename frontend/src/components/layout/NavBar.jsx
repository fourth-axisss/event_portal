// import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
// import { Link, NavLink, useNavigate } from 'react-router-dom';
// import { useAuth } from '../../context/AuthContext';
// import { ROLES } from '../../utils/constants';

// export default function NavBar() {
//   const { user, capabilities, logout } = useAuth();
//   const navigate = useNavigate();
//   const isAdmin = user.role === ROLES.ADMIN;

//   function handleLogout() {
//     logout();
//     navigate('/login', { replace: true });
//   }

//   return (
//     <Navbar expand="lg" data-bs-theme="dark" className="app-navbar">
//       <Container>
//         <Navbar.Brand as={Link} to="/" className="brand-mark">
//           <span className="brand-square" />
//           LNMIIT <span className="brand-sub">Events</span>
//         </Navbar.Brand>
//         <Navbar.Toggle aria-controls="main-nav" />
//         <Navbar.Collapse id="main-nav">
//           <Nav className="me-auto">
//             <Nav.Link as={NavLink} to="/" end>Dashboard</Nav.Link>
//             {!isAdmin && <Nav.Link as={NavLink} to="/events">Browse events</Nav.Link>}
//             {capabilities?.can_organize && <Nav.Link as={NavLink} to="/organize">Organize</Nav.Link>}
//             {isAdmin && <Nav.Link as={NavLink} to="/admin">Admin</Nav.Link>}
//           </Nav>
//           <Nav>
//             <NavDropdown title={user.name} align="end">
//               <NavDropdown.ItemText className="small text-muted">{user.email}</NavDropdown.ItemText>
//               <NavDropdown.Divider />
//               <NavDropdown.Item onClick={handleLogout}>Log out</NavDropdown.Item>
//             </NavDropdown>
//           </Nav>
//         </Navbar.Collapse>
//       </Container>
//     </Navbar>
//   );
// }

import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import NotificationBell from '../NotificationBell';

export default function NavBar() {
  const { user, capabilities, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === ROLES.ADMIN;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Navbar expand="lg" data-bs-theme="dark" className="app-navbar">
      <Container>
        <Navbar.Brand as={Link} to="/" className="brand-mark">
          <span className="brand-square" />
          LNMIIT <span className="brand-sub">Events</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>Dashboard</Nav.Link>
            {!isAdmin && <Nav.Link as={NavLink} to="/events">Browse events</Nav.Link>}
            {!isAdmin && <Nav.Link as={NavLink} to="/me/registrations">My registrations</Nav.Link>}
            {capabilities?.can_organize && <Nav.Link as={NavLink} to="/organize">Organize</Nav.Link>}
            {isAdmin && <Nav.Link as={NavLink} to="/admin">Admin</Nav.Link>}
          </Nav>
          <Nav className="align-items-lg-center">
            <NotificationBell />
            <NavDropdown title={user.name} align="end">
              <NavDropdown.ItemText className="small text-muted">{user.email}</NavDropdown.ItemText>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>Log out</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

/*


import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';

export default function NavBar() {
  const { user, capabilities, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user.role === ROLES.ADMIN;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Navbar expand="lg" data-bs-theme="dark" className="app-navbar">
      <Container>
        <Navbar.Brand as={Link} to="/" className="brand-mark">
          <span className="brand-square" />
          LNMIIT <span className="brand-sub">Events</span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>Dashboard</Nav.Link>
            {!isAdmin && <Nav.Link as={NavLink} to="/events">Browse events</Nav.Link>}
            {!isAdmin && <Nav.Link as={NavLink} to="/me/registrations">My registrations</Nav.Link>}
            {capabilities?.can_organize && <Nav.Link as={NavLink} to="/organize">Organize</Nav.Link>}
            {isAdmin && <Nav.Link as={NavLink} to="/admin">Admin</Nav.Link>}
          </Nav>
          <Nav>
            <NavDropdown title={user.name} align="end">
              <NavDropdown.ItemText className="small text-muted">{user.email}</NavDropdown.ItemText>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>Log out</NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}*/