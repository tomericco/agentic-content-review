export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex flex-col items-center justify-center gap-2">
      <p className="text-[13px] text-[#9ca3af] font-ui">404</p>
      <p className="text-[20px] font-medium text-[#000000] font-ui">
        The agent must have eaten this one.
      </p>
      <p className="text-[13px] text-[#9ca3af] font-ui">
        This review doesn&apos;t exist — or never made it past the draft stage.
      </p>
    </div>
  )
}
