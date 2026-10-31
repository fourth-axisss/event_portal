import { Container } from 'react-bootstrap';
import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';

export default function AppLayout() {
  return (
    <>
      <NavBar />
      <Container as="main" className="py-4">
        <Outlet />
      </Container>
    </>
  );
}