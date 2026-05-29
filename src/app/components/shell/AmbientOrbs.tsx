export function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(84,185,249,0.45),transparent_70%)] blur-3xl animate-float" />
      <div className="absolute top-1/3 -right-40 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(138,211,41,0.35),transparent_70%)] blur-3xl animate-float2" />
      <div className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(84,185,249,0.3),transparent_70%)] blur-3xl animate-float" />
    </div>
  );
}
