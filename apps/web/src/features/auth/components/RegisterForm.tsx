"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("MARKETING");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (!res.ok) {
        throw new Error("Error al registrar el usuario");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Ocurrió un error");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-white p-8 w-full max-w-[450px] rounded-[20px] shadow-sm mx-auto">
      {errorMsg && <p className="text-red-500 text-sm text-center font-medium">{errorMsg}</p>}
      <div className="flex flex-col">
        <label className="text-[#151717] font-semibold text-sm mb-1">Nombre completo</label>
        <div className="border-[1.5px] border-[#ecedec] rounded-[10px] h-[50px] flex items-center px-3 transition-colors duration-200 focus-within:border-[#2d79f3]">
          <svg height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg" className="fill-gray-400 shrink-0">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
          </svg>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ml-2.5 rounded-[10px] border-none flex-1 h-full focus:outline-none bg-transparent text-[#151717] text-sm w-full" 
            placeholder="Ej. Equipo Marketing" 
            required
          />
        </div>
      </div>

      <div className="flex flex-col mt-2">
        <label className="text-[#151717] font-semibold text-sm mb-1">Correo electrónico</label>
        <div className="border-[1.5px] border-[#ecedec] rounded-[10px] h-[50px] flex items-center px-3 transition-colors duration-200 focus-within:border-[#2d79f3]">
          <svg height="20" viewBox="0 0 32 32" width="20" xmlns="http://www.w3.org/2000/svg" className="fill-gray-400 shrink-0">
            <g id="Layer_3" data-name="Layer 3">
              <path d="m30.853 13.87a15 15 0 0 0 -29.729 4.082 15.1 15.1 0 0 0 12.876 12.918 15.6 15.6 0 0 0 2.016.13 14.85 14.85 0 0 0 7.715-2.145 1 1 0 1 0 -1.031-1.711 13.007 13.007 0 1 1 5.458-6.529 2.149 2.149 0 0 1 -4.158-.759v-10.856a1 1 0 0 0 -2 0v1.726a8 8 0 1 0 .2 10.325 4.135 4.135 0 0 0 7.83.274 15.2 15.2 0 0 0 .823-7.455zm-14.853 8.13a6 6 0 1 1 6-6 6.006 6.006 0 0 1 -6 6z"></path>
            </g>
          </svg>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ml-2.5 rounded-[10px] border-none flex-1 h-full focus:outline-none bg-transparent text-[#151717] text-sm w-full" 
            placeholder="marketing@almaquinta.com" 
            required
          />
        </div>
      </div>

      <div className="flex flex-col mt-2">
        <label className="text-[#151717] font-semibold text-sm mb-1">Contraseña</label>
        <div className="border-[1.5px] border-[#ecedec] rounded-[10px] h-[50px] flex items-center px-3 transition-colors duration-200 focus-within:border-[#2d79f3]">
          <svg height="20" viewBox="-64 0 512 512" width="20" xmlns="http://www.w3.org/2000/svg" className="fill-gray-400 shrink-0">
            <path d="m336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0"></path>
            <path d="m304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0"></path>
          </svg>        
          <input 
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ml-2.5 rounded-[10px] border-none flex-1 h-full focus:outline-none bg-transparent text-[#151717] text-sm w-full" 
            placeholder="Crea una contraseña" 
            required
          />
          <svg 
            viewBox="0 0 576 512" 
            height="1em" 
            xmlns="http://www.w3.org/2000/svg" 
            className="fill-gray-400 cursor-pointer hover:fill-gray-600 transition-colors shrink-0"
            onClick={() => setShowPassword(!showPassword)}
          >
            <path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"></path>
          </svg>
        </div>
      </div>

      <div className="flex flex-col mt-2">
        <label className="text-[#151717] font-semibold text-sm mb-1">Rol</label>
        <div className="border-[1.5px] border-[#ecedec] rounded-[10px] h-[50px] flex items-center px-3 transition-colors duration-200 focus-within:border-[#2d79f3] bg-white">
          <svg height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg" className="fill-gray-400 shrink-0">
            <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"></path>
          </svg>
          <select 
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="ml-2.5 border-none flex-1 h-full focus:outline-none bg-transparent text-[#151717] text-sm w-full cursor-pointer"
          >
            <option value="MARKETING">Marketing</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
      </div>
      
      <button type="submit" className="mt-5 mb-2.5 bg-[#151717] text-white text-[15px] font-medium rounded-[10px] h-[50px] w-full cursor-pointer hover:bg-[#252727] transition-colors duration-200">
        Registrarse
      </button>
      
      <p className="text-center text-gray-600 text-[14px] my-1.5">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="text-[#2d79f3] font-medium cursor-pointer hover:underline">
          Inicia Sesión
        </Link>
      </p>
    </form>
  );
}
