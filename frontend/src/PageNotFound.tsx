import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="mx-5 grid min-h-screen md:mx-36">
      <p className="mx-auto my-auto mt-20 flex w-full max-w-6xl flex-col place-items-center gap-6 rounded-3xl bg-gray-100 p-6 text-jet lg:p-10 xl:p-16">
        <h1>404</h1>
        <p>The page you are looking for does not exist.</p>
        <button className="pointer-cursor mr-4 flex cursor-pointer items-center justify-center rounded-full bg-blue-1000 py-2 px-4 text-white hover:bg-blue-3000">
          <Link to="/">Go Back Home</Link>
        </button>
      </p>
    </div>
  );
}
